import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/email/mail-spf.js';
import {
  fakeDns,
  runMailHint,
  type FakeAnswer,
} from '../../lib/email/fakes.js';

const run = (txt: Record<string, FakeAnswer>) =>
  runMailHint(hint, {
    dns: fakeDns({ 'example.test MX': ['10 mx.example.test.'], ...txt }),
  });

describe('mail-spf', () => {
  it('passes a strict record', async () => {
    expect(await run({ 'example.test TXT': ['"v=spf1 mx -all"'] })).toEqual([]);
  });

  it('reports a missing record', async () => {
    const problems = await run({ 'example.test TXT': ['"hello"'] });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toBe(
      'Your domain does *not* have a valid SPF record.',
    );
    expect(problems[0].sourceCode).toBe(
      'example.test. IN TXT "v=spf1 mx -all"',
    );
  });

  it('reports a domain that does not exist as TXT', async () => {
    const problems = await run({ 'example.test TXT': { status: 3 } });
    expect(problems.map((p) => p.message)).toEqual([
      'Your domain does *not* have a valid SPF record.',
    ]);
  });

  it('reports more than one SPF record', async () => {
    const problems = await run({
      'example.test TXT': ['"v=spf1 -all"', '"v=spf1 ~all"'],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('does *not* have a valid SPF record');
    expect(problems[0].sourceCode).toBe('v=spf1 -all\nv=spf1 ~all');
  });

  it('is silent when the lookup fails', async () => {
    expect(await run({ 'example.test TXT': { status: 2 } })).toEqual([]);
  });

  it('reports invalid syntax', async () => {
    const problems = await run({
      'example.test TXT': ['"v=spf1 nonsense -all"'],
    });
    expect(problems.map((p) => p.message)).toEqual([
      'Your SPF policy is *not* syntactically correct.',
    ]);
    expect(problems[0].sourceCode).toBe('example.test: v=spf1 nonsense -all');
  });

  it('reports a weak policy', async () => {
    const problems = await run({ 'example.test TXT': ['"v=spf1 mx ?all"'] });
    expect(problems.map((p) => p.message)).toEqual([
      'Your SPF policy is *not* sufficiently strict.',
    ]);
    expect(problems[0].sourceCode).toBe('example.test: v=spf1 mx ?all');
  });

  it('reports more than ten lookups', async () => {
    const terms = Array(11).fill('mx').join(' ');
    const problems = await run({
      'example.test TXT': [`"v=spf1 ${terms} -all"`],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain(
      'more than the allowed 10 DNS lookups',
    );
  });

  it('follows includes and reports a weak one', async () => {
    const problems = await run({
      'example.test TXT': ['"v=spf1 include:_spf.vendor.test -all"'],
      '_spf.vendor.test TXT': ['"v=spf1 +all"'],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("'include' mechanism");
    expect(problems[0].sourceCode).toContain('_spf.vendor.test: v=spf1 +all');
  });

  it('reports a failing redirect', async () => {
    const problems = await run({
      'example.test TXT': ['"v=spf1 redirect=_spf.vendor.test"'],
      '_spf.vendor.test TXT': { status: 2 },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("'redirect' modifier");
  });

  it('accepts a redirect to a strict policy', async () => {
    expect(
      await run({
        'example.test TXT': ['"v=spf1 redirect=_spf.vendor.test"'],
        '_spf.vendor.test TXT': ['"v=spf1 ip4:192.0.2.0/24 -all"'],
      }),
    ).toEqual([]);
  });

  it('is silent without MX records', async () => {
    expect(
      await runMailHint(hint, {
        dns: fakeDns({ 'example.test TXT': ['"hello"'] }),
      }),
    ).toEqual([]);
  });
});
