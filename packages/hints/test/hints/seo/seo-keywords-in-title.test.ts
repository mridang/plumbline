import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/seo-keywords-in-title.js';
import { htmlPage } from '../../helpers/page.js';
import { runHint } from '../../helpers/run-hint.js';

describe('seo-keywords-in-title', () => {
  it('passes when the title has a keyword', async () => {
    expect(
      await runHint(
        hint,
        htmlPage({
          title: 'All about zebra',
          body: '<p>zebra zebra zebra</p>',
        }),
      ),
    ).toEqual([]);
  });

  it('reports a title without the keywords', async () => {
    const problems = await runHint(
      hint,
      htmlPage({ body: '<p>zebra zebra zebra</p>' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('zebra');
  });
});
