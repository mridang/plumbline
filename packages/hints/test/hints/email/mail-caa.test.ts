import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-caa.js';
import { fakeDns, runMailHint } from '../../lib/email/fakes.js';

const run = (table: Record<string, string[]>) =>
  runMailHint(hint, {
    dns: fakeDns({ 'example.test MX': ['10 mx.example.test.'], ...table }),
  });

describe('mail-caa', () => {
  it('belongs to the internetnl, email, dns and tls groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'email', 'dns', 'tls']);
  });

  it('passes with a valid CAA that has an issue property', async () => {
    expect(
      await run({ 'mx.example.test CAA': ['0 issue "letsencrypt.org"'] }),
    ).toEqual([]);
  });

  it('finds the CAA of a parent domain of the mail server', async () => {
    expect(
      await run({ 'example.test CAA': ['0 issue "letsencrypt.org"'] }),
    ).toEqual([]);
  });

  it('warns when the mail server has no CAA', async () => {
    const problems = await run({});
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toBe(
      'mx.example.test: Your mail server does not have CAA.',
    );
    expect(problems[0].sourceCode).toBe(
      'mx.example.test. IN CAA 0 issue "ca.example.net"',
    );
  });

  it('warns about a syntax error', async () => {
    const problems = await run({
      'mx.example.test CAA': ['0 issue "ca.test"', '0 iodef "ftp://x"'],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain(
      'mx.example.test: Your mail server has an invalid CAA',
    );
    expect(problems[0].sourceCode).toBe(
      'mx.example.test. IN CAA 0 issue "ca.test"\nmx.example.test. IN CAA 0 iodef "ftp://x"',
    );
  });

  it('warns about a missing issue property', async () => {
    const problems = await run({
      'mx.example.test CAA': ['0 iodef "mailto:a@example.org"'],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('insufficiently protective');
    expect(problems[0].sourceCode).toContain(
      'mx.example.test. IN CAA 0 issue "ca.example.net"',
    );
  });

  it('reports each mail server on its own', async () => {
    const problems = await runMailHint(hint, {
      dns: fakeDns({
        'example.test MX': ['10 a.example.test.', '20 b.example.test.'],
        'a.example.test CAA': ['0 issue "ca.test"'],
      }),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('b.example.test:');
  });

  it('stays silent without MX records', async () => {
    expect(await runMailHint(hint, { dns: fakeDns({}) })).toEqual([]);
  });
});
