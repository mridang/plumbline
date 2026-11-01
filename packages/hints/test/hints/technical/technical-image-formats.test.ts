import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/technical/technical-image-formats.js';
import { htmlPage } from '../../helpers/page.js';
import { runHint } from '../../helpers/run-hint.js';

describe('technical-image-formats', () => {
  it('passes WebP images', async () => {
    expect(
      await runHint(hint, htmlPage({ body: '<img src="a.webp">' })),
    ).toEqual([]);
  });

  it('reports only legacy formats', async () => {
    const problems = await runHint(
      hint,
      htmlPage({ body: '<img src="a.jpg"><img src="b.png">' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('none use WebP or AVIF');
  });
});
