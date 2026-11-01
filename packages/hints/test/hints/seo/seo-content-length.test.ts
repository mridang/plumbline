import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/seo-content-length.js';
import { htmlPage } from '../../helpers/page.js';
import { runHint } from '../../helpers/run-hint.js';

describe('seo-content-length', () => {
  it('passes a page with enough text', async () => {
    expect(
      await runHint(
        hint,
        htmlPage({
          body: '<p>word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word word </p>',
        }),
      ),
    ).toEqual([]);
  });

  it('reports a thin page', async () => {
    const problems = await runHint(
      hint,
      htmlPage({ body: '<p>too short</p>' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('2 words of text');
  });
});
