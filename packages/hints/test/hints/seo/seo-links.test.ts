import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/seo-links.js';
import { htmlPage } from '../../helpers/page.js';
import { runHint } from '../../helpers/run-hint.js';

describe('seo-links', () => {
  it('passes with an internal link', async () => {
    expect(
      await runHint(hint, htmlPage({ body: '<a href="/about">About us</a>' })),
    ).toEqual([]);
  });

  it('reports a page without links', async () => {
    const problems = await runHint(hint, htmlPage({}));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no links');
  });

  it('reports a page with only external links', async () => {
    const problems = await runHint(
      hint,
      htmlPage({ body: '<a href="https://example.org/">Other</a>' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('none to its own site');
  });
});
