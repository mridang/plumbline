import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/x-frame-options.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string> = {}) => ({ '/': { headers } });
const owasp = { hintOptions: { profile: 'owasp' } };

describe('x-frame-options', () => {
  it.each(['DENY', 'SAMEORIGIN'])('passes %s', async (value) => {
    expect(await runHint(hint, page({ 'x-frame-options': value }))).toEqual([]);
  });

  it('passes with CSP frame-ancestors instead', async () => {
    expect(
      await runHint(
        hint,
        page({ 'content-security-policy': "frame-ancestors 'none'" }),
      ),
    ).toEqual([]);
  });

  it('reports a missing header', async () => {
    const problems = await runHint(hint, page());
    expect(problems).toHaveLength(1);
    expect(problems[0]?.sourceCode).toBe('X-Frame-Options: DENY');
    expect(problems[0]?.message).toContain('not implemented');
  });

  it('gives a hint for ALLOW-FROM', async () => {
    const problems = await runHint(
      hint,
      page({ 'x-frame-options': 'ALLOW-FROM https://a.example' }),
    );
    expect(problems[0]?.sourceCode).toBe(
      'X-Frame-Options: ALLOW-FROM https://a.example',
    );
    expect(problems[0]?.message).toContain('ALLOW-FROM');
  });

  it('reports an unrecognised value', async () => {
    const problems = await runHint(
      hint,
      page({ 'x-frame-options': 'allowall' }),
    );
    expect(problems[0]?.message).toContain('cannot be recognized');
  });

  it('owasp: requires deny', async () => {
    expect(
      await runHint(hint, page({ 'x-frame-options': 'deny' }), owasp),
    ).toEqual([]);
    const same = await runHint(
      hint,
      page({ 'x-frame-options': 'SAMEORIGIN' }),
      owasp,
    );
    expect(same[0]?.message).toContain("should be 'deny'");
    const csp = await runHint(
      hint,
      page({ 'content-security-policy': "frame-ancestors 'none'" }),
      owasp,
    );
    expect(csp[0]?.message).toContain('not specified');
  });
});
