import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-dmarc.js';
import {
  fakeDns,
  runMailHint,
  type FakeAnswer,
} from '../../lib/email/fakes.js';

const run = (txt: Record<string, FakeAnswer>) =>
  runMailHint(hint, {
    dns: fakeDns({ 'example.test MX': ['10 mx.example.test.'], ...txt }),
  });

const DMARC = '_dmarc.example.test TXT';

describe('mail-dmarc', () => {
  it('passes a strict record', async () => {
    expect(
      await run({
        [DMARC]: ['"v=DMARC1; p=reject; rua=mailto:r@example.test"'],
      }),
    ).toEqual([]);
  });

  it('reports a missing record', async () => {
    const problems = await run({ [DMARC]: { status: 3 } });
    expect(problems.map((p) => p.message)).toEqual([
      'Your domain does *not* have a DMARC record.',
    ]);
    expect(problems[0].sourceCode).toBe(
      '_dmarc.example.test. IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.test"',
    );
  });

  it('ignores TXT records that are not DMARC', async () => {
    const problems = await run({ [DMARC]: ['"hello"'] });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('does *not* have a DMARC record');
  });

  it('reports more than one record', async () => {
    const problems = await run({
      [DMARC]: ['"v=DMARC1; p=reject"', '"v=DMARC1; p=quarantine"'],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('does *not* have a DMARC record');
    expect(problems[0].sourceCode).toBe(
      'v=DMARC1; p=reject\nv=DMARC1; p=quarantine',
    );
  });

  it('is silent when the lookup fails', async () => {
    expect(await run({ [DMARC]: { status: 2 } })).toEqual([]);
  });

  it('reports invalid syntax', async () => {
    const problems = await run({ [DMARC]: ['"v=DMARC1; p=allow"'] });
    expect(problems.map((p) => p.message)).toEqual([
      'Your DMARC policy is *not* syntactically correct.',
    ]);
    expect(problems[0].sourceCode).toBe('v=DMARC1; p=allow');
  });

  it('reports a policy of none', async () => {
    const problems = await run({ [DMARC]: ['"v=DMARC1; p=none"'] });
    expect(problems.map((p) => p.message)).toEqual([
      'Your DMARC policy is *not* sufficiently strict.',
    ]);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].sourceCode).toBe('v=DMARC1; p=none');
  });

  it('reports quarantine in test mode', async () => {
    const problems = await run({ [DMARC]: ['"v=DMARC1; p=quarantine; t=y"'] });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('not* sufficiently strict');
  });

  it('warns about an unauthorised external report address', async () => {
    const problems = await run({
      [DMARC]: ['"v=DMARC1; p=reject; rua=mailto:r@vendor.test"'],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('external mail address');
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].sourceCode).toBe(
      'v=DMARC1; p=reject; rua=mailto:r@vendor.test',
    );
  });

  it('accepts an authorised external report address', async () => {
    expect(
      await run({
        [DMARC]: ['"v=DMARC1; p=reject; rua=mailto:r@vendor.test"'],
        'example.test._report._dmarc.vendor.test TXT': ['"v=DMARC1;"'],
      }),
    ).toEqual([]);
  });

  it('is silent without MX records', async () => {
    expect(await runMailHint(hint, { dns: fakeDns({}) })).toEqual([]);
  });
});
