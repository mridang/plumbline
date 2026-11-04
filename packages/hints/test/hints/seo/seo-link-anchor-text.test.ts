import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/seo/seo-link-anchor-text.js';
import { htmlPage } from '../../helpers/page.js';
import { runHint } from '../../helpers/run-hint.js';

describe('seo-link-anchor-text', () => {
  it('passes descriptive text', async () => {
    expect(
      await runHint(hint, htmlPage({ body: '<a href="/x">Pricing plans</a>' })),
    ).toEqual([]);
  });

  it('reports generic text', async () => {
    const problems = await runHint(
      hint,
      htmlPage({ body: '<a href="/x">click here</a>' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('generic text');
  });

  it('reports a link with no text', async () => {
    const problems = await runHint(
      hint,
      htmlPage({ body: '<a href="/x"></a>' }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no text');
  });
});
