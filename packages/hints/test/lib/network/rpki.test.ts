import { afterEach, describe, expect, it } from '@jest/globals';
import { rpki, type RpkiResult } from '../../../src/core/rpki.js';
import {
  collectRpki,
  describe as describeEntries,
  judgeValidity,
  missingRoa,
  nsRpki,
  rpkiLines,
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

  it('asks about every address at once and keeps the order of the answers', async () => {
    restore = installDns({
      'example.test': {
        A: { data: ['192.0.2.1', '192.0.2.2'] },
        AAAA: { data: ['2001:db8::1'] },
      },
    });
    let running = 0;
    let most = 0;
    const finished: string[] = [];
    rpki.client = {
      async check(ip) {
        running += 1;
        most = Math.max(most, running);
        // The first address is the slowest, so a lookup that waited its turn would come out in another order.
        await new Promise((resolve) =>
          setTimeout(resolve, ip === '192.0.2.1' ? 30 : 1),
        );
        running -= 1;
        finished.push(ip);
        return { asn: 1, prefix: 'p', status: 'valid' };
      },
    };
    const found = await collectRpki(['example.test']);
    expect(found.map((e) => e.ip)).toEqual([
      '192.0.2.1',
      '192.0.2.2',
      '2001:db8::1',
    ]);
    expect(most).toBe(3);
    expect(finished[finished.length - 1]).toBe('192.0.2.1');
  });

  it('skips only the addresses the validator fails on', async () => {
    restore = installDns({
      'example.test': { A: { data: ['192.0.2.1', '192.0.2.2'] } },
    });
    rpki.client = {
      check: (ip) =>
        ip === '192.0.2.1'
          ? Promise.reject(new Error('down'))
          : Promise.resolve({ asn: 1, prefix: 'p', status: 'valid' }),
    };
    expect((await collectRpki(['example.test'])).map((e) => e.ip)).toEqual([
      '192.0.2.2',
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

describe('rpkiLines', () => {
  it('renders the route and state of each entry', () => {
    expect(rpkiLines([entry('invalid'), entry('unknown', null)])).toBe(
      'h 192.0.2.1 192.0.2.0/24 AS1 invalid\nh 192.0.2.1 no route unknown',
    );
  });
});
