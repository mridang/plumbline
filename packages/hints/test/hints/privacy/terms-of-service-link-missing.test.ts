import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/privacy/terms-of-service-link-missing.js';
import { runHint } from '../../helpers/run-hint.js';

/** A page with the given `<head>` additions and `<body>`. */
function page(body: string, head = '') {
  return {
    '/': () => ({
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: `<!doctype html><html lang="en"><head><title>A fine page title</title>${head}</head><body><h1>Heading</h1>${body}</body></html>`,
    }),
  };
}

describe('terms-of-service-link-missing', () => {
  it('passes when the footer links it', async () => {
    expect(
      await runHint(
        hint,
        page('<footer><a href="/terms">Terms of service</a></footer>'),
      ),
    ).toEqual([]);
  });

  it('passes with the registered link relation in the head', async () => {
    expect(
      await runHint(hint, page('', '<link rel="terms-of-service" href="/t">')),
    ).toEqual([]);
  });

  it('warns when the page does not link it', async () => {
    const problems = await runHint(
      hint,
      page('<footer><a href="/privacy">Privacy</a></footer>'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('links to no terms of service');
    expect(problems[0].message).toContain(
      'https://support.google.com/cloud/answer/15549049',
    );
  });

  it('shows the link to add, against the body', async () => {
    const [problem] = await runHint(hint, page(''));
    expect(problem.sourceCode).toContain('rel="terms-of-service"');
    expect(problem.location.line).toBeGreaterThanOrEqual(0);
  });
});
