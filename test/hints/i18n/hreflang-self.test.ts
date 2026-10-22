import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/i18n/hreflang-self.js';
import { runHint } from '../../helpers/run-hint.js';

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

describe('hreflang-self', () => {
  it('passes when an alternate references the page itself', async () => {
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

  it('passes when there are no hreflang alternates', async () => {
    expect(
      await runHint(
        hint,
        routes(() => ''),
      ),
    ).toEqual([]);
  });

  it('reports a set that does not reference the page', async () => {
    const problems = await runHint(
      hint,
      routes(
        (url) =>
          `<link rel="alternate" hreflang="fr" href="${url}fr">` +
          `<link rel="alternate" hreflang="de" href="${url}de">`,
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('none references the page itself');
    expect(problems[0].message).toContain(
      'https://developers.google.com/search/docs/specialty/international/localized-versions',
    );
  });
});
