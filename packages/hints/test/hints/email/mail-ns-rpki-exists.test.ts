import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import type { RpkiClient, RpkiResult } from '../../../src/core/rpki.js';
import hint from '../../../src/hints/email/mail-ns-rpki-exists.js';
import { fakeDns, runMailHint } from '../../lib/email/fakes.js';

const dns = fakeDns({
  'example.test MX': ['10 mx.example.test.'],
  'example.test NS': ['ns.example.net.'],
  'ns.example.net A': ['192.0.2.9'],
  'ns.example.net AAAA': ['2001:db8::9'],
});

/** A RPKI client answering from a table; unknown addresses are not routed. */
const rpki = (table: Record<string, RpkiResult>): RpkiClient => ({
  check: (ip) =>
    Promise.resolve(
      table[ip] ?? { asn: null, prefix: null, status: 'unknown' },
    ),
});

const valid = (prefix: string): RpkiResult => ({
  asn: 64500,
  prefix,
  status: 'valid',
});

describe('mail-ns-rpki-exists', () => {
  it('belongs to the internetnl, email and dns groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'email', 'dns']);
  });

  it('passes when every name server address has a ROA', async () => {
    const client = rpki({
      '192.0.2.9': valid('192.0.2.0/24'),
      '2001:db8::9': valid('2001:db8::/32'),
    });
    expect(await runMailHint(hint, { dns, rpki: client })).toEqual([]);
  });

  it('accepts an announcement whose ROA does not match, which is for the validity hint', async () => {
    const client = rpki({
      '192.0.2.9': { asn: 1, prefix: '192.0.2.0/24', status: 'invalid' },
      '2001:db8::9': valid('2001:db8::/32'),
    });
    expect(await runMailHint(hint, { dns, rpki: client })).toEqual([]);
  });

  it('reports a name server address without a ROA', async () => {
    const client = rpki({
      '192.0.2.9': { asn: 64500, prefix: '192.0.2.0/24', status: 'unknown' },
      '2001:db8::9': valid('2001:db8::/32'),
    });
    const problems = await runMailHint(hint, { dns, rpki: client });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain(
      'mx.example.test: For at least one of the IP addresses of the name servers of your mail server no RPKI Route Origin Authorisation',
    );
    expect(problems[0].sourceCode).toBe(
      'ns.example.net 192.0.2.9 192.0.2.0/24 AS64500 unknown',
    );
  });

  it('stays silent without MX records', async () => {
    expect(
      await runMailHint(hint, { dns: fakeDns({}), rpki: rpki({}) }),
    ).toEqual([]);
  });
});
