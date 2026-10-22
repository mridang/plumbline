import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import type { RpkiClient, RpkiResult } from '../../../src/core/rpki.js';
import hint from '../../../src/hints/email/mail-ns-rpki-valid.js';
import { fakeDns, runMailHint } from '../../lib/email/fakes.js';

const dns = fakeDns({
  'example.test MX': ['10 mx.example.test.'],
  'example.test NS': ['ns.example.net.'],
  'ns.example.net A': ['192.0.2.9'],
});

const rpki = (result: RpkiResult): RpkiClient => ({
  check: () => Promise.resolve(result),
});

describe('mail-ns-rpki-valid', () => {
  it('belongs to the internetnl, email and dns groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'email', 'dns']);
  });

  it('passes for a valid announcement', async () => {
    const client = rpki({ asn: 1, prefix: '192.0.2.0/24', status: 'valid' });
    expect(await runMailHint(hint, { dns, rpki: client })).toEqual([]);
  });

  it('reports an invalid announcement', async () => {
    const client = rpki({ asn: 1, prefix: '192.0.2.0/24', status: 'invalid' });
    const problems = await runMailHint(hint, { dns, rpki: client });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain(
      'mx.example.test: At least one IP address of the name servers of your mail server has an `Invalid` validation state',
    );
    expect(problems[0].sourceCode).toBe(
      'ns.example.net 192.0.2.9 192.0.2.0/24 AS1 invalid',
    );
  });

  it('reports a NotFound announcement', async () => {
    const client = rpki({ asn: 1, prefix: '192.0.2.0/24', status: 'unknown' });
    const problems = await runMailHint(hint, { dns, rpki: client });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('`NotFound` validation state');
    expect(problems[0].sourceCode).toBe(
      'ns.example.net 192.0.2.9 192.0.2.0/24 AS1 unknown',
    );
  });

  it('is not tested when nothing is routed', async () => {
    const client = rpki({ asn: null, prefix: null, status: 'unknown' });
    expect(await runMailHint(hint, { dns, rpki: client })).toEqual([]);
  });

  it('stays silent without MX records', async () => {
    const client = rpki({ asn: 1, prefix: 'p', status: 'invalid' });
    expect(await runMailHint(hint, { dns: fakeDns({}), rpki: client })).toEqual(
      [],
    );
  });
});
