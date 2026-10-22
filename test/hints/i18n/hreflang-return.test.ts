import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/i18n/hreflang-return.js';
import { runHint } from '../../helpers/run-hint.js';

/** A page whose head is built from the live page URL (so hrefs are absolute). */
function routes(headFor: (url: string) => string) {
  return {
    '/': (req: IncomingMessage) => ({
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: `<!doctype html><html lang="en"><head><title>A fine page title</title>${headFor(
        `http://${req.headers.host}/`,
      )}</head><body><h1>Heading</h1></body></html>`,
    }),
  };
}

describe('hreflang-return', () => {
  it('passes when every alternate is absolute', async () => {
    const problems = await runHint(
      hint,
      routes(
        (url) =>
          `<link rel="alternate" hreflang="en" href="${url}">` +
          `<link rel="alternate" hreflang="fr" href="${url}fr">`,
      ),
    );
    expect(problems).toEqual([]);
  });

  it('reports each non-absolute alternate', async () => {
    const problems = await runHint(
      hint,
      routes(
        () =>
          '<link rel="alternate" hreflang="en" href="/en">' +
          '<link rel="alternate" hreflang="fr" href="//host/fr">',
      ),
    );
    expect(problems).toHaveLength(2);
    expect(problems[0].message).toContain('not an absolute URL');
    expect(problems[0].message).toContain(
      'https://developers.google.com/search/docs/specialty/international/localized-versions',
    );
  });
});
