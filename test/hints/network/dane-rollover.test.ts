import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/network/dane-rollover.js';
import { installDns, type Zone } from '../../lib/network/fake-dns.js';
import { runHint } from '../../helpers/run-hint.js';

let restore: () => void = () => undefined;
afterEach(() => restore());

const SHA = (n: number): string => n.toString(16).padStart(2, '0').repeat(32);
const tlsa = (data: string[], ad = true): Zone => ({
  '_443._tcp.example.test': { TLSA: { data, ad } },
});
const run = (zone: Zone) => {
  restore = installDns(zone);
  return runHint(hint);
};

describe('dane-rollover', () => {
  it('belongs to the internetnl, dns and tls groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'dns', 'tls']);
  });

  it('passes with the current and the next key', async () => {
    expect(await run(tlsa([`3 1 1 ${SHA(1)}`, `3 1 1 ${SHA(2)}`]))).toEqual([]);
  });

  it('passes with the current key and its issuer', async () => {
    expect(await run(tlsa([`3 1 1 ${SHA(1)}`, `2 1 1 ${SHA(2)}`]))).toEqual([]);
  });

  it('warns about a single record', async () => {
    const problems = await run(tlsa([`3 1 1 ${SHA(1)}`]));
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain(
      'does *not* have a proper scheme for rolling DANE certificates',
    );
    expect(problems[0].sourceCode).toBe(
      `_443._tcp.example.test. IN TLSA 3 1 1 ${SHA(1)}`,
    );
  });

  it('warns about records that do not make a scheme', async () => {
    const problems = await run(tlsa([`2 1 1 ${SHA(1)}`, `1 1 1 ${SHA(2)}`]));
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe(
      `_443._tcp.example.test. IN TLSA 2 1 1 ${SHA(1)}\n_443._tcp.example.test. IN TLSA 1 1 1 ${SHA(2)}`,
    );
  });

  it('is not tested without DANE', async () => {
    expect(await run({})).toEqual([]);
  });

  it('is not tested when the TLSA records are not DNSSEC secured', async () => {
    expect(await run(tlsa([`3 1 1 ${SHA(1)}`], false))).toEqual([]);
  });
});
