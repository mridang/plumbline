import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/i18n/hreflang-x-default.js';
import { runHint } from '../../helpers/run-hint.js';

function routes(head: string) {
  return {
    '/': {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: `<!doctype html><html lang="en"><head><title>A fine page title</title>${head}</head><body><h1>Heading</h1></body></html>`,
    },
  };
}

describe('hreflang-x-default', () => {
  it('passes when there are no hreflang alternates', async () => {
    expect(await runHint(hint, routes(''))).toEqual([]);
  });

  it('passes when an x-default is present', async () => {
    const problems = await runHint(
      hint,
      routes(
        '<link rel="alternate" hreflang="en" href="https://x.test/">' +
          '<link rel="alternate" hreflang="x-default" href="https://x.test/">',
      ),
    );
    expect(problems).toEqual([]);
  });

  it('reports a set with no x-default', async () => {
    const problems = await runHint(
      hint,
      routes('<link rel="alternate" hreflang="en" href="https://x.test/">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('x-default');
    expect(problems[0].message).toContain(
      'https://developers.google.com/search/docs/specialty/international/localized-versions',
    );
  });
});
