import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/seo-robots-nofollow.js';
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

describe('seo-robots-nofollow', () => {
  it('passes without a robots tag', async () => {
    expect(await runHint(hint, pageRoutes({ head: '' }))).toEqual([]);
  });

  it('passes with noindex only', async () => {
    expect(
      await runHint(
        hint,
        pageRoutes({ head: '<meta name="robots" content="noindex">' }),
      ),
    ).toEqual([]);
  });

  it('reports nofollow', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({ head: '<meta name="robots" content="nofollow">' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('nofollow');
    expect(problems[0].message).toContain(
      'https://www.opengraph.to/articles/robots-nofollow',
    );
  });

  it('reports nofollow among other directives', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({ head: '<meta name="robots" content="noindex, NoFollow">' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('nofollow');
    expect(problems[0].message).toContain(
      'https://www.opengraph.to/articles/robots-nofollow',
    );
  });

  it('reports nofollow in a googlebot meta tag', async () => {
    expect(
      await runHint(
        hint,
        pageRoutes({ head: '<meta name="googlebot" content="nofollow">' }),
      ),
    ).toHaveLength(1);
  });

  it('reports nofollow from the X-Robots-Tag header', async () => {
    const routes = pageRoutes({ head: '' });
    const page = routes['/'];
    expect(
      await runHint(hint, {
        '/': (req) => ({
          ...page(req),
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'x-robots-tag': 'googlebot: nofollow',
          },
        }),
      }),
    ).toHaveLength(1);
  });

  it('reports nofollow implied by none', async () => {
    expect(
      await runHint(
        hint,
        pageRoutes({ head: '<meta name="robots" content="none">' }),
      ),
    ).toHaveLength(1);
  });

  it('points at the robots meta tag', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({ head: '<meta name="robots" content="nofollow">' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toContain(
      '<meta name="robots" content="nofollow">',
    );
    expect(problems[0].location.line).toBeGreaterThanOrEqual(0);
  });

  it('shows the X-Robots-Tag header line', async () => {
    const problems = await runHint(hint, {
      '/': {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'x-robots-tag': 'nofollow',
        },
        body: '<!doctype html><html lang="en"><head><title>A fine page title</title></head><body><h1>h</h1></body></html>',
      },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toBe('X-Robots-Tag: nofollow');
  });
});
