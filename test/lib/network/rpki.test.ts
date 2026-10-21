import { afterEach, describe, expect, it } from '@jest/globals';
import { rpki, type RpkiResult } from '../../../src/core/rpki.js';
import {
  collectRpki,
  describe as describeEntries,
  judgeValidity,
  missingRoa,
  nsRpki,
  webRpki,
  type IpRpki,
} from '../../../src/lib/network/rpki.js';
import { installDns } from './fake-dns.js';

const realClient = rpki.client;
let restore: () => void = () => undefined;
afterEach(() => {
  restore();
  rpki.client = realClient;
});

const entry = (
  status: RpkiResult['status'],
  asn: number | null = 1,
): IpRpki => ({
  host: 'h',
  ip: '192.0.2.1',
  result: { asn, prefix: asn ? '192.0.2.0/24' : null, status },
});

describe('collectRpki', () => {
  it('checks every A and AAAA address of the hosts', async () => {
    restore = installDns({
      'example.test': {
        A: { data: ['192.0.2.1'] },
        AAAA: { data: ['2001:db8::1'] },
      },
      'ns.example.test': { A: { data: ['192.0.2.9'] } },
      '': {},
    });
    const seen: string[] = [];
    rpki.client = {
      async check(ip) {
        seen.push(ip);
        return { asn: 64500, prefix: 'p', status: 'valid' };
      },
    };
    expect((await webRpki('example.test')).map((e) => e.ip)).toEqual([
      '192.0.2.1',
      '2001:db8::1',
    ]);
    expect(seen).toHaveLength(2);
  });

  it('uses the name servers for the ns variant', async () => {
    restore = installDns({
      'example.test': { NS: { data: ['ns.example.net.'] } },
      'ns.example.net': { A: { data: ['192.0.2.9'] } },
    });
    rpki.client = {
      check: async () => ({ asn: 1, prefix: 'p', status: 'valid' }),
    };
    const result = await nsRpki('example.test');
    expect(result.map((r) => [r.host, r.ip])).toEqual([
      ['ns.example.net', '192.0.2.9'],
    ]);
  });

  it('skips addresses when the validator fails', async () => {
    restore = installDns({ 'example.test': { A: { data: ['192.0.2.1'] } } });
    rpki.client = { check: () => Promise.reject(new Error('down')) };
    expect(await collectRpki(['example.test'])).toEqual([]);
  });
});

describe('missingRoa', () => {
  it('counts only unknown status as missing', () => {
    expect(
      missingRoa([entry('valid'), entry('invalid'), entry('unknown')]),
    ).toHaveLength(1);
    expect(missingRoa([entry('unknown', null)])).toHaveLength(1);
  });
});

describe('judgeValidity', () => {
  it('has no verdict without addresses', () => {
    expect(judgeValidity([]).verdict).toBe('none');
  });
  it('is invalid when any route is invalid', () => {
    const j = judgeValidity([
      entry('valid'),
      entry('invalid'),
      entry('unknown'),
    ]);
    expect(j.verdict).toBe('invalid');
    expect(j.offenders).toHaveLength(1);
  });
  it('is bad when a routed address has no ROA', () => {
    expect(judgeValidity([entry('valid'), entry('unknown')]).verdict).toBe(
      'bad',
    );
  });
  it('is not-routed when no address has a route', () => {
    expect(judgeValidity([entry('unknown', null)]).verdict).toBe('not-routed');
  });
  it('is good when every routed address is valid', () => {
    expect(
      judgeValidity([entry('valid'), entry('unknown', null)]).verdict,
    ).toBe('good');
  });
  it('describes entries', () => {
    expect(describeEntries([entry('valid')])).toBe('h (192.0.2.1)');
  });
});
