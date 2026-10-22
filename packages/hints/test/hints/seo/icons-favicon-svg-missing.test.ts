import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/icons-favicon-svg-missing.js';
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

describe('icons-favicon-svg-missing', () => {
  it('passes with an svg by type', async () => {
    expect(
      await runHint(
        hint,
        pageRoutes({
          head: '<link rel="icon" type="image/svg+xml" href="/f">',
        }),
      ),
    ).toEqual([]);
  });

  it('passes with an svg by extension', async () => {
    expect(
      await runHint(
        hint,
        pageRoutes({ head: '<link rel="icon" href="/f.svg">' }),
      ),
    ).toEqual([]);
  });

  it('reports a png only', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({ head: '<link rel="icon" type="image/png" href="/f.png">' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('No SVG');
    expect(problems[0].message).toContain(
      'https://www.opengraph.to/articles/missing-svg-favicon',
    );
  });

  it('reports no icon', async () => {
    const problems = await runHint(hint, pageRoutes({ head: '' }));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('No SVG');
    expect(problems[0].message).toContain(
      'https://www.opengraph.to/articles/missing-svg-favicon',
    );
  });

  it('suggests the link to add to the head', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({ head: '<title>A fine page title</title>' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toContain('image/svg+xml');
    expect(problems[0].location.line).toBeGreaterThanOrEqual(0);
  });
});
