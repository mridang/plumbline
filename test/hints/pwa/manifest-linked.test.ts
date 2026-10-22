import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/pwa/manifest-linked.js';
import { runHint } from '../../helpers/run-hint.js';

/** Builds a page whose <head> carries `head`. */
function page(head: string) {
  return {
    '/': {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: `<!doctype html><html lang="en"><head><title>A fine title</title>${head}</head><body><h1>Hi</h1></body></html>`,
    },
  };
}

describe('manifest-linked', () => {
  it('passes with an absolute manifest link', async () => {
    expect(
      await runHint(hint, page('<link rel="manifest" href="/m.webmanifest">')),
    ).toEqual([]);
  });

  it('reports a missing manifest link as an error with the fix snippet', async () => {
    const problems = await runHint(hint, page(''));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('links no Web App Manifest');
    expect(problems[0].sourceCode).toContain('rel="manifest"');
  });

  it('warns about a document-relative manifest href', async () => {
    const problems = await runHint(
      hint,
      page('<link rel="manifest" href="manifest.json">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('document-relative');
  });
});
