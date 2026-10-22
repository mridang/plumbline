import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/discovery/rel-me.js';
import { runHint } from '../../helpers/run-hint.js';

const html = (head: string) =>
  `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body></body></html>`;

const page = (head: string, headers: Record<string, string> = {}) => ({
  '/': {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: html(head),
  },
});

describe('rel-me', () => {
  it('is silent when there are no rel=me links', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });

  it('reports a rel=me link in the DOM', async () => {
    const problems = await runHint(
      hint,
      page('<link rel="me" href="https://github.com/x">'),
    );
    expect(problems[0].message).toContain('rel=me');
  });

  it('warns on a rel=me link with no href', async () => {
    const problems = await runHint(
      hint,
      page('<a rel="me" href="">profile</a>'),
    );
    expect(problems[0].message).toContain('no href');
  });

  it('reads a rel=me from the Link header', async () => {
    const problems = await runHint(
      hint,
      page('', { link: '<https://github.com/x>; rel="me"' }),
    );
    expect(problems[0].message).toContain('rel=me');
  });
});
