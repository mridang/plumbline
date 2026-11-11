import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/emailpolicy/bimi.js';
import {
  fakeDns,
  runMailHint,
  type FakeAnswer,
} from '../../lib/email/fakes.js';

const run = (txt: Record<string, FakeAnswer>) =>
  runMailHint(hint, {
    dns: fakeDns({ 'example.test MX': ['10 mx.example.test.'], ...txt }),
  });

describe('bimi', () => {
  it('notes a valid record with the DMARC prerequisite', async () => {
    const problems = await run({
      'default._bimi.example.test TXT': [
        '"v=BIMI1; l=https://example.test/logo.svg"',
      ],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toContain('must also enforce DMARC');
  });

  it('warns when no record is published', async () => {
    const problems = await run({ 'default._bimi.example.test TXT': [] });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('does *not* publish a BIMI record');
  });

  it('reports a logo that is not an SVG', async () => {
    const problems = await run({
      'default._bimi.example.test TXT': [
        '"v=BIMI1; l=https://example.test/logo.png"',
      ],
    });
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain('must point to an SVG file');
  });

  it('reports a non-https logo', async () => {
    const problems = await run({
      'default._bimi.example.test TXT': [
        // eslint-disable-next-line unicorn/prefer-https -- test fixture: the http logo URL is the input being rejected
        '"v=BIMI1; l=http://example.test/logo.svg"',
      ],
    });
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain('must be served over `https:`');
  });

  it('is silent when the domain has no MX', async () => {
    expect(
      await runMailHint(hint, {
        dns: fakeDns({ 'default._bimi.example.test TXT': [] }),
      }),
    ).toEqual([]);
  });
});
