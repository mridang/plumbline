import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/seo-title-too-long.js';
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
      body: `<!doctype html>${parts.html ?? '<html lang="en">'}<head>${
        headFor ? headFor(`http://${req.headers.host}/`) : parts.head
      }</head><body>${parts.body ?? '<h1>Heading</h1>'}</body></html>`,
    }),
  };
}

describe('seo-title-too-long', () => {
  it('passes at exactly 70 characters', async () => {
    expect(
      await runHint(
        hint,
        pageRoutes({
          head: '<title>xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</title>',
        }),
      ),
    ).toEqual([]);
  });

  it('reports 71 characters', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({
        head: '<title>xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</title>',
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('71 characters');
    expect(problems[0].message).toContain(
      'https://www.opengraph.to/articles/html-title-too-long',
    );
  });

  it('ignores a missing title', async () => {
    expect(await runHint(hint, pageRoutes({ head: '' }))).toEqual([]);
  });

  it('points at the title', async () => {
    const problems = await runHint(
      hint,
      pageRoutes({
        head: '<title>xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</title>',
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].sourceCode).toContain('<title>xxx');
    expect(problems[0].location.line).toBeGreaterThanOrEqual(0);
  });
});
