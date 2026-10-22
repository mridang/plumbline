import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/seo-h1-missing.js';
import { runHint } from '../../helpers/run-hint.js';

/**
 * Builds the routes for a page. `head` is inserted into <head>, `body` into
 * <body> and `html` replaces the opening <html> tag. The page is otherwise
 * valid, so only the rule under test can fail. A function `head` receives
 * nothing here; the optional second argument builds the head from the page URL.
 */
function pageRoutes(
  parts: { head: string; body?: string; html?: string },
  headFor?: (url: string) => string,
) {
  return {
    '/': (req: import('node:http').IncomingMessage) => ({
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: `<!doctype html>${parts.html ?? '<html lang="en">'}<head><title>A fine page title</title>${
        headFor ? headFor(`http://${req.headers.host}/`) : parts.head
      }</head><body>${parts.body ?? '<h1>Heading</h1>'}</body></html>`,
    }),
  };
}

describe('seo-h1-missing', () => {
  it('passes with an h1', async () => {
    expect(await runHint(hint, pageRoutes({ head: '' }))).toEqual([]);
  });

  it('reports a missing h1', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({ head: '', body: '<h2>Hi</h2>' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no <h1>');
    expect(problems[0].message).toContain(
      'https://www.opengraph.to/articles/missing-h1',
    );
  });

  it('suggests an h1', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({ head: '', body: '<p>text</p>' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toContain('<h1>');
    expect(problems[0].location.line).toBeGreaterThanOrEqual(0);
  });
});
