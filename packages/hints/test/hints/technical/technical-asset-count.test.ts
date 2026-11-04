import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/technical/technical-asset-count.js';
import { htmlPage } from '../../helpers/page.js';
import { runHint } from '../../helpers/run-hint.js';

describe('technical-asset-count', () => {
  it('passes a lean page', async () => {
    expect(
      await runHint(
        hint,
        htmlPage({ head: '<script src="/a.js" defer></script>' }),
      ),
    ).toEqual([]);
  });

  it('reports many scripts', async () => {
    const problems = await runHint(
      hint,
      htmlPage({
        head: '<script src="/0.js" defer></script><script src="/1.js" defer></script><script src="/2.js" defer></script><script src="/3.js" defer></script><script src="/4.js" defer></script><script src="/5.js" defer></script><script src="/6.js" defer></script><script src="/7.js" defer></script><script src="/8.js" defer></script><script src="/9.js" defer></script><script src="/10.js" defer></script><script src="/11.js" defer></script><script src="/12.js" defer></script><script src="/13.js" defer></script><script src="/14.js" defer></script><script src="/15.js" defer></script>',
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('16 external scripts');
  });

  it('reports a blocking script', async () => {
    const problems = await runHint(
      hint,
      htmlPage({ head: '<script src="/a.js"></script>' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('block rendering');
  });
});
