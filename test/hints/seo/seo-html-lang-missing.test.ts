import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/seo-html-lang-missing.js';
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

describe('seo-html-lang-missing', () => {
  it('passes with a lang', async () => {
    expect(await runHint(hint, pageRoutes({ head: '' }))).toEqual([]);
  });

  it('reports a missing lang', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({ head: '', html: '<html>' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no lang');
    expect(problems[0].message).toContain(
      'https://www.opengraph.to/articles/missing-html-lang',
    );
  });

  it('reports a blank lang', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({ head: '', html: '<html lang=" ">' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no lang');
    expect(problems[0].message).toContain(
      'https://www.opengraph.to/articles/missing-html-lang',
    );
  });
});
