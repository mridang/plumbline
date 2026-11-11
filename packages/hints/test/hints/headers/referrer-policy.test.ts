import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/referrer-policy.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string | string[]> = {}, head = '') => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body></body></html>`,
  },
});

const owasp = { hintOptions: { profile: 'owasp' } };

describe('referrer-policy', () => {
  it('passes a private policy', async () => {
    expect(
      await runHint(
        hint,
        page({ 'referrer-policy': 'strict-origin-when-cross-origin' }),
      ),
    ).toEqual([]);
  });

  it('warns when no policy is set', async () => {
    const problems = await runHint(hint, page());
    expect(problems).toHaveLength(1);
    expect(problems[0]?.sourceCode).toBe(
      'Referrer-Policy: strict-origin-when-cross-origin',
    );
    expect(problems[0]?.message).toContain('not implemented');
  });

  it('reports an unsafe policy', async () => {
    const problems = await runHint(
      hint,
      page({ 'referrer-policy': 'unsafe-url' }),
    );
    expect(problems[0]?.sourceCode).toBe('Referrer-Policy: unsafe-url');
    expect(problems[0]?.message).toContain('set unsafely');
  });

  it('reports an unrecognised policy', async () => {
    const problems = await runHint(
      hint,
      page({ 'referrer-policy': 'sometimes' }),
    );
    expect(problems[0]?.message).toContain('cannot be recognized');
  });

  it('lets a meta name=referrer override the header', async () => {
    expect(
      await runHint(
        hint,
        page(
          { 'referrer-policy': 'unsafe-url' },
          '<meta name="referrer" content="same-origin">',
        ),
      ),
    ).toEqual([]);
  });

  it('lets a meta http-equiv override the header', async () => {
    const problems = await runHint(
      hint,
      page(
        { 'referrer-policy': 'no-referrer' },
        '<meta http-equiv="Referrer-Policy" content="unsafe-url">',
      ),
    );
    expect(problems[0]?.sourceCode).toBe(
      '<meta http-equiv="Referrer-Policy" content="unsafe-url">',
    );
    expect(problems[0]?.message).toContain('set unsafely');
  });

  it('uses the last known value of a list', async () => {
    expect(
      await runHint(
        hint,
        page({ 'referrer-policy': 'unsafe-url, same-origin' }),
      ),
    ).toEqual([]);
  });

  it('owasp: requires no-referrer', async () => {
    expect(
      await runHint(hint, page({ 'referrer-policy': 'no-referrer' }), owasp),
    ).toEqual([]);
    const strict = await runHint(
      hint,
      page({ 'referrer-policy': 'same-origin' }),
      owasp,
    );
    expect(strict[0]?.message).toContain("'no-referrer'");
    const unspecified = await runHint(hint, page(), owasp);
    expect(unspecified[0]?.message).toContain('not specified');
  });
});
