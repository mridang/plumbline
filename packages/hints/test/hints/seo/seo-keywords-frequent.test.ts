import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/seo-keywords-frequent.js';
import { htmlPage } from '../../helpers/page.js';
import { runHint } from '../../helpers/run-hint.js';

describe('seo-keywords-frequent', () => {
  it('lists the most frequent keywords', async () => {
    const problems = await runHint(
      hint,
      htmlPage({ body: '<p>apple apple apple banana banana</p>' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('apple (3), banana (2)');
  });

  it('stays quiet without repeated keywords', async () => {
    expect(
      await runHint(hint, htmlPage({ body: '<p>one two three</p>' })),
    ).toEqual([]);
  });
});
