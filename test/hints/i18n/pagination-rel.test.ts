import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/i18n/pagination-rel.js';
import { runHint } from '../../helpers/run-hint.js';

function routes(head: string) {
  return {
    '/': {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: `<!doctype html><html lang="en"><head><title>A fine page title</title>${head}</head><body><h1>Heading</h1></body></html>`,
    },
  };
}

describe('pagination-rel', () => {
  it('passes well-formed prev/next links', async () => {
    const problems = await runHint(
      hint,
      routes(
        '<link rel="prev" href="https://x.test/1">' +
          '<link rel="next" href="https://x.test/3">',
      ),
    );
    expect(problems).toEqual([]);
  });

  it('passes when neither relation is present', async () => {
    expect(await runHint(hint, routes(''))).toEqual([]);
  });

  it('reports a blank prev and a non-absolute next', async () => {
    const problems = await runHint(
      hint,
      routes('<link rel="prev" href="">' + '<link rel="next" href="/3">'),
    );
    expect(problems).toHaveLength(2);
    expect(problems.map((p) => p.message).join('\n')).toContain(
      'not an absolute URL',
    );
    expect(problems[0].message).toContain(
      'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel',
    );
  });
});
