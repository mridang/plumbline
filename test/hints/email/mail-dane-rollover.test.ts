import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-dane-rollover.js';
import {
  fakeDns,
  runMailHint,
  type FakeAnswer,
} from '../../lib/email/fakes.js';

const sha = (n: number): string => n.toString(16).padStart(2, '0').repeat(32);

const run = (tlsa: FakeAnswer) =>
  runMailHint(hint, {
    dns: fakeDns({
      'example.test MX': ['10 mx.example.test.'],
      '_25._tcp.mx.example.test TLSA': tlsa,
    }),
  });

const signed = (...data: string[]): FakeAnswer => ({
  authenticated: true,
  data,
});

describe('mail-dane-rollover', () => {
  it('belongs to the internetnl, email, dns and tls groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'email', 'dns', 'tls']);
  });

  it('passes with the current and the next key', async () => {
    expect(await run(signed(`3 1 1 ${sha(1)}`, `3 1 1 ${sha(2)}`))).toEqual([]);
  });

  it('passes with the current key and its issuer', async () => {
    expect(await run(signed(`3 1 1 ${sha(1)}`, `2 1 1 ${sha(2)}`))).toEqual([]);
  });

  it('informs about a single record', async () => {
    const problems = await run(signed(`3 1 1 ${sha(1)}`));
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toContain(
      'mx.example.test: Your mail server domain does *not* have an active DANE scheme',
    );
    expect(problems[0].sourceCode).toBe(
      `_25._tcp.mx.example.test. IN TLSA 3 1 1 ${sha(1)}`,
    );
  });

  it('ignores the PKIX usages when counting records', async () => {
    const problems = await run(signed(`3 1 1 ${sha(1)}`, `1 1 1 ${sha(2)}`));
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe(
      `_25._tcp.mx.example.test. IN TLSA 3 1 1 ${sha(1)}`,
    );
  });

  it('is not tested when only PKIX records exist', async () => {
    expect(await run(signed(`1 1 1 ${sha(1)}`, `0 1 1 ${sha(2)}`))).toEqual([]);
  });

  it('is not tested without DANE', async () => {
    expect(await run(signed())).toEqual([]);
  });

  it('is not tested when the TLSA records are not DNSSEC secured', async () => {
    expect(await run([`3 1 1 ${sha(1)}`])).toEqual([]);
  });

  it('is not tested when the TLSA lookup fails validation', async () => {
    expect(await run({ status: 2 })).toEqual([]);
  });

  it('stays silent without MX records', async () => {
    expect(await runMailHint(hint, { dns: fakeDns({}) })).toEqual([]);
  });
});
