import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/icons-apple-touch-icon-missing.js';
import { htmlPage } from '../../helpers/page.js';
import { runHint } from '../../helpers/run-hint.js';

describe('icons-apple-touch-icon-missing', () => {
  it('passes with an icon', async () => {
    expect(
      await runHint(
        hint,
        htmlPage({ head: '<link rel="apple-touch-icon" href="/i.png">' }),
      ),
    ).toEqual([]);
  });

  it('reports a missing icon', async () => {
    const problems = await runHint(hint, htmlPage({}));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('apple-touch-icon');
  });
});
