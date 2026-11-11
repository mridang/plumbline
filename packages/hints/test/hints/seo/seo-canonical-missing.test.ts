import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/seo-canonical-missing.js';
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

describe('seo-canonical-missing', () => {
  it('passes with a canonical', async () => {
    expect(
      await runHint(
        hint,
        pageRoutes({
          // eslint-disable-next-line unicorn/prefer-https -- test fixture
          head: '<link rel="canonical" href="http://example.com/">',
        }),
      ),
    ).toEqual([]);
  });

  it('reports a missing canonical', async () => {
    const problems = await runHint(hint, pageRoutes({ head: '' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('No canonical');
    expect(problems[0].message).toContain(
      'https://www.opengraph.to/articles/missing-canonical-url',
    );
  });

  it('reports an empty canonical href', async () => {
    expect(
      await runHint(
        hint,
        pageRoutes({ head: '<link rel="canonical" href="">' }),
      ),
    ).toHaveLength(1);
  });

  it('suggests the canonical link to add', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({ head: '<title>A fine page title</title>' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toContain(
      '<link rel="canonical" href="http://127.0.0.1:',
    );
    expect(problems[0].location.line).toBeGreaterThanOrEqual(0);
  });
});
