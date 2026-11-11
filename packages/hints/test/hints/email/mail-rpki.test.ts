import { describe, expect, it } from '@jest/globals';
import type { RpkiClient, RpkiResult } from '../../../src/core/rpki.js';
import hint from '../../../src/hints/email/mail-rpki.js';
import { fakeDns, runMailHint } from '../../lib/email/fakes.js';

const dns = fakeDns({
  'example.test MX': ['10 mx.example.test.'],
  'mx.example.test A': ['192.0.2.10'],
  'mx.example.test AAAA': ['2001:db8::10'],
});

/** A RPKI client answering from a table; unknown addresses are not routed. */
const rpki = (table: Record<string, RpkiResult | Error>): RpkiClient => ({
  check: (ip) => {
    const entry = table[ip];
    if (entry instanceof Error) {
      return Promise.reject(entry);
    }
    return Promise.resolve(
      entry ?? { asn: null, prefix: null, status: 'unknown' },
    );
  },
});

const valid = (prefix: string): RpkiResult => ({
  asn: 64_500,
  prefix,
  status: 'valid',
});

describe('mail-rpki', () => {
  it('passes when every route has a valid ROA', async () => {
    const client = rpki({
      '192.0.2.10': valid('192.0.2.0/24'),
      '2001:db8::10': valid('2001:db8::/32'),
    });
    expect(await runMailHint(hint, { dns, rpki: client })).toEqual([]);
  });

  it('reports a route without a ROA', async () => {
    const client = rpki({
      '192.0.2.10': { asn: 64_500, prefix: '192.0.2.0/24', status: 'unknown' },
      '2001:db8::10': valid('2001:db8::/32'),
    });
    const problems = await runMailHint(hint, { dns, rpki: client });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('`NotFound`');
    expect(problems[0].sourceCode).toContain(
      'mx.example.test 192.0.2.10 192.0.2.0/24 AS64500',
    );
  });

  it('reports a route with an invalid ROA', async () => {
    const client = rpki({
      '192.0.2.10': valid('192.0.2.0/24'),
      '2001:db8::10': {
        asn: 64_501,
        prefix: '2001:db8::/32',
        status: 'invalid',
      },
    });
    const problems = await runMailHint(hint, { dns, rpki: client });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('`Invalid`');
  });

  it('skips addresses that are not routed', async () => {
    expect(await runMailHint(hint, { dns, rpki: rpki({}) })).toEqual([]);
  });

  it('skips addresses the validation service fails on', async () => {
    const client = rpki({
      '192.0.2.10': new Error('service down'),
      '2001:db8::10': new Error('service down'),
    });
    expect(await runMailHint(hint, { dns, rpki: client })).toEqual([]);
  });

  it('is silent without MX records', async () => {
    expect(
      await runMailHint(hint, { dns: fakeDns({}), rpki: rpki({}) }),
    ).toEqual([]);
  });
});
