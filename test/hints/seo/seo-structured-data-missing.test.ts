import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/seo-structured-data-missing.js';
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

describe('seo-structured-data-missing', () => {
  it('passes with JSON-LD', async () => {
    expect(
      await runHint(
        hint,
        pageRoutes({
          head: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script>',
        }),
      ),
    ).toEqual([]);
  });

  it('reports an empty block', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({ head: '<script type="application/ld+json"></script>' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('No JSON-LD');
    expect(problems[0].message).toContain(
      'https://www.opengraph.to/articles/missing-structured-data',
    );
  });

  it('reports no block', async () => {
    const problems = await runHint(hint, pageRoutes({ head: '' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('No JSON-LD');
    expect(problems[0].message).toContain(
      'https://www.opengraph.to/articles/missing-structured-data',
    );
  });

  it('reports invalid JSON-LD', async () => {
    expect(
      await runHint(
        hint,
        pageRoutes({
          head: '<script type="application/ld+json">{oops</script>',
        }),
      ),
    ).toHaveLength(1);
  });

  it('passes with a @graph', async () => {
    expect(
      await runHint(
        hint,
        pageRoutes({
          head: '<script type="application/ld+json">{"@graph":[{"@type":"WebPage"}]}</script>',
        }),
      ),
    ).toEqual([]);
  });
});
