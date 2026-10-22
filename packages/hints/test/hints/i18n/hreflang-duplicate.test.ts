import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/i18n/hreflang-duplicate.js';
import { runHint } from '../../helpers/run-hint.js';

function routes(head: string) {
  return {
    '/': {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: `<!doctype html><html lang="en"><head><title>A fine page title</title>${head}</head><body><h1>Heading</h1></body></html>`,
    },
  };
}

describe('hreflang-duplicate', () => {
  it('passes when each value is unique', async () => {
    const problems = await runHint(
      hint,
      routes(
        '<link rel="alternate" hreflang="en" href="https://x.test/en">' +
          '<link rel="alternate" hreflang="fr" href="https://x.test/fr">',
      ),
    );
    expect(problems).toEqual([]);
  });

  it('reports each repeat after the first', async () => {
    const problems = await runHint(
      hint,
      routes(
        '<link rel="alternate" hreflang="en" href="https://x.test/en">' +
          '<link rel="alternate" hreflang="EN" href="https://x.test/en2">' +
          '<link rel="alternate" hreflang="en" href="https://x.test/en3">',
      ),
    );
    expect(problems).toHaveLength(2);
    expect(problems[0].message).toContain('declared more than once');
    expect(problems[0].message).toContain(
      'https://developers.google.com/search/docs/specialty/international/localized-versions',
    );
  });
});
