import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/coep.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string | string[]> = {}, head = '') => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body></body></html>`,
  },
});

const owasp = { hintOptions: { profile: 'owasp' } };

describe('coep', () => {
  it('passes the strict value', async () => {
    expect(
      await runHint(
        hint,
        page({ 'cross-origin-embedder-policy': 'require-corp' }),
      ),
    ).toEqual([]);
  });

  it('gives advice when the header is missing', async () => {
    const problems = await runHint(hint, page());
    expect(problems).toHaveLength(1);
    expect(problems[0]?.sourceCode).toBe(
      'Cross-Origin-Embedder-Policy: require-corp',
    );
    expect(problems[0]?.message).toContain('not implemented');
  });

  it('gives advice for the permissive value', async () => {
    const problems = await runHint(
      hint,
      page({ 'cross-origin-embedder-policy': 'unsafe-none' }),
    );
    expect(problems[0]?.message).toContain('no protection');
  });

  it('reports a value it cannot recognise', async () => {
    const problems = await runHint(
      hint,
      page({ 'cross-origin-embedder-policy': 'bogus' }),
    );
    expect(problems[0]?.sourceCode).toBe('Cross-Origin-Embedder-Policy: bogus');
    expect(problems[0]?.message).toContain('cannot be recognized');
  });

  it('owasp: requires require-corp', async () => {
    expect(
      await runHint(
        hint,
        page({ 'cross-origin-embedder-policy': 'require-corp' }),
        owasp,
      ),
    ).toEqual([]);
    const missing = await runHint(hint, page(), owasp);
    expect(missing[0]?.message).toContain('not specified');
    const other = await runHint(
      hint,
      page({ 'cross-origin-embedder-policy': 'unsafe-none' }),
      owasp,
    );
    expect(other[0]?.message).toContain("should be 'require-corp'");
  });

  it('accepts credentialless', async () => {
    expect(
      await runHint(
        hint,
        page({ 'cross-origin-embedder-policy': 'credentialless' }),
      ),
    ).toEqual([]);
  });
});
