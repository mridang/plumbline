import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/coop.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string | string[]> = {}, head = '') => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body></body></html>`,
  },
});

const owasp = { hintOptions: { profile: 'owasp' } };

describe('coop', () => {
  it('passes the strict value', async () => {
    expect(
      await runHint(
        hint,
        page({ 'cross-origin-opener-policy': 'same-origin' }),
      ),
    ).toEqual([]);
  });

  it('gives advice when the header is missing', async () => {
    const problems = await runHint(hint, page());
    expect(problems).toHaveLength(1);
    expect(problems[0]?.sourceCode).toBe(
      'Cross-Origin-Opener-Policy: same-origin',
    );
    expect(problems[0]?.message).toContain('not implemented');
  });

  it('gives advice for the permissive value', async () => {
    const problems = await runHint(
      hint,
      page({ 'cross-origin-opener-policy': 'unsafe-none' }),
    );
    expect(problems[0]?.message).toContain('no protection');
  });

  it('reports a value it cannot recognise', async () => {
    const problems = await runHint(
      hint,
      page({ 'cross-origin-opener-policy': 'bogus' }),
    );
    expect(problems[0]?.sourceCode).toBe('Cross-Origin-Opener-Policy: bogus');
    expect(problems[0]?.message).toContain('cannot be recognized');
  });

  it('owasp: requires same-origin', async () => {
    expect(
      await runHint(
        hint,
        page({ 'cross-origin-opener-policy': 'same-origin' }),
        owasp,
      ),
    ).toEqual([]);
    const missing = await runHint(hint, page(), owasp);
    expect(missing[0]?.message).toContain('not specified');
    const other = await runHint(
      hint,
      page({ 'cross-origin-opener-policy': 'unsafe-none' }),
      owasp,
    );
    expect(other[0]?.message).toContain("should be 'same-origin'");
  });

  it('accepts parameters', async () => {
    expect(
      await runHint(
        hint,
        page({ 'cross-origin-opener-policy': 'same-origin; report-to="x"' }),
      ),
    ).toEqual([]);
  });
});
