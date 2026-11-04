import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/seo-responsive-images.js';
import { htmlPage } from '../../helpers/page.js';
import { runHint } from '../../helpers/run-hint.js';

describe('seo-responsive-images', () => {
  it('passes a page without images', async () => {
    expect(await runHint(hint, htmlPage({}))).toEqual([]);
  });

  it('passes images with srcset', async () => {
    expect(
      await runHint(
        hint,
        htmlPage({ body: '<img src="a.jpg" srcset="a.jpg 1x, a2.jpg 2x">' }),
      ),
    ).toEqual([]);
  });

  it('reports fixed-size images', async () => {
    const problems = await runHint(
      hint,
      htmlPage({ body: '<img src="a.jpg"><img src="b.jpg">' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('2 of 2 images');
  });
});
