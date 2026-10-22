import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/icons-favicon-32-missing.js';
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

describe('icons-favicon-32-missing', () => {
  it('passes with a 32x32 png', async () => {
    expect(
      await runHint(
        hint,
        pageRoutes({
          head: '<link rel="icon" type="image/png" sizes="32x32" href="/f.png">',
        }),
      ),
    ).toEqual([]);
  });

  it('reports a png without sizes', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({ head: '<link rel="icon" type="image/png" href="/f.png">' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('32x32');
    expect(problems[0].message).toContain(
      'https://www.opengraph.to/articles/missing-favicon-32',
    );
  });

  it('reports a 16x16 png only', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({
        head: '<link rel="icon" type="image/png" sizes="16x16" href="/f.png">',
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('32x32');
    expect(problems[0].message).toContain(
      'https://www.opengraph.to/articles/missing-favicon-32',
    );
  });

  it('reports an ico only', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({ head: '<link rel="icon" href="/favicon.ico">' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('32x32');
    expect(problems[0].message).toContain(
      'https://www.opengraph.to/articles/missing-favicon-32',
    );
  });

  it('suggests the link to add to the head', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({ head: '<title>A fine page title</title>' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toContain('sizes="32x32"');
    expect(problems[0].location.line).toBeGreaterThanOrEqual(0);
  });
});
