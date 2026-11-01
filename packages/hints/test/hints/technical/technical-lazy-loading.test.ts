import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/technical/technical-lazy-loading.js';
import { htmlPage } from '../../helpers/page.js';
import { runHint } from '../../helpers/run-hint.js';

describe('technical-lazy-loading', () => {
  it('passes lazy images', async () => {
    expect(
      await runHint(
        hint,
        htmlPage({
          body: '<img src="1.jpg"><img src="2.jpg"><img src="3.jpg" loading="lazy">',
        }),
      ),
    ).toEqual([]);
  });

  it('reports eager images after the first two', async () => {
    const problems = await runHint(
      hint,
      htmlPage({
        body: '<img src="1.jpg"><img src="2.jpg"><img src="3.jpg"><img src="4.jpg">',
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('2 images after the first 2');
  });
});
