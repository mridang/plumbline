import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/twitter-card-missing.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('twitter-card-missing', () => {
  it('passes with twitter:card', async () => {
    expect(
      await runHint(
        hint,
        page('<meta name="twitter:card" content="summary_large_image">'),
      ),
    ).toEqual([]);
  });

  it('reports a missing twitter:card', async () => {
    const problems = await runHint(hint, page(''));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no twitter:card');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/missing-twitter-card',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.warning);
  });
});
