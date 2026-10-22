import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/headers/csp.js';
import { runHint } from '../../helpers/run-hint.js';

const page = (headers: Record<string, string | string[]> = {}, head = '') => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body></body></html>`,
  },
});

const owasp = { hintOptions: { profile: 'owasp' } };

describe('csp', () => {
  it('passes a strict policy', async () => {
    expect(
      await runHint(
        hint,
        page({ 'content-security-policy': "default-src 'none'" }),
      ),
    ).toEqual([]);
  });

  it('reports a missing policy', async () => {
    const problems = await runHint(hint, page());
    expect(problems).toHaveLength(1);
    expect(problems[0]?.sourceCode).toMatch(
      /^Content-Security-Policy: default-src/,
    );
    expect(problems[0]?.message).toContain('header not implemented');
  });

  it('reports a report-only policy as not enforced', async () => {
    const problems = await runHint(
      hint,
      page({ 'content-security-policy-report-only': "default-src 'none'" }),
    );
    expect(problems[0]?.message).toContain('Report-Only');
  });

  it('reports an unparsable policy', async () => {
    const problems = await runHint(
      hint,
      page({ 'content-security-policy': "img-src 'self'; img-src *" }),
    );
    expect(problems[0]?.message).toContain('cannot be parsed');
  });

  it('reports unsafe-inline in script-src', async () => {
    const problems = await runHint(
      hint,
      page({
        'content-security-policy':
          "default-src 'self'; script-src 'unsafe-inline'",
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('implemented unsafely');
  });

  it('reports unsafe-eval', async () => {
    const problems = await runHint(
      hint,
      page({ 'content-security-policy': "default-src 'self' 'unsafe-eval'" }),
    );
    expect(problems[0]?.sourceCode).toMatch(
      /^Content-Security-Policy: .*unsafe-eval/,
    );
    expect(problems[0]?.message).toContain("allows 'unsafe-eval'");
  });

  it('warns about unsafe-inline in style-src only', async () => {
    const problems = await runHint(
      hint,
      page({
        'content-security-policy':
          "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'",
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('style-src');
  });

  it('warns about duplicate report-uri directives', async () => {
    const problems = await runHint(
      hint,
      page({
        'content-security-policy':
          "default-src 'none'; report-uri /a; report-uri /b",
      }),
    );
    expect(problems[0]?.message).toContain('duplicate directives');
  });

  it('reads a policy from a meta tag', async () => {
    expect(
      await runHint(
        hint,
        page(
          {},
          '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'">',
        ),
      ),
    ).toEqual([]);
  });

  it('ignores a meta policy with only header-only directives', async () => {
    const problems = await runHint(
      hint,
      page(
        {},
        '<meta http-equiv="Content-Security-Policy" content="frame-ancestors \'none\'">',
      ),
    );
    expect(problems[0]?.sourceCode).toBe(
      '<meta http-equiv="Content-Security-Policy" content="frame-ancestors \'none\'">',
    );
    expect(problems[0]?.message).toContain('header not implemented');
  });

  it('owasp: passes a policy without unsafe', async () => {
    expect(
      await runHint(
        hint,
        page({ 'content-security-policy': "default-src 'self'" }),
        owasp,
      ),
    ).toEqual([]);
  });

  it('owasp: reports a missing header and an unsafe one', async () => {
    expect((await runHint(hint, page(), owasp))[0]?.message).toContain(
      'not specified',
    );
    const unsafe = await runHint(
      hint,
      page({ 'content-security-policy': "script-src 'unsafe-inline'" }),
      owasp,
    );
    expect(unsafe[0]?.message).toContain("should not contain 'unsafe'");
  });
});
