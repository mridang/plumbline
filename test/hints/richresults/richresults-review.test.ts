import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/richresults/richresults-review.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './helper.js';

describe('richresults-review', () => {
  it('does nothing when no Review node is present', async () => {
    expect(await runHint(hint, page({ '@type': 'WebPage' }))).toEqual([]);
  });

  it('errors when a Review lacks itemReviewed and a rating value', async () => {
    const problems = await runHint(hint, page({ '@type': 'Review' }));
    expect(problems.filter((p) => p.severity === Severity.error)).toHaveLength(
      2,
    );
  });

  it('passes a complete Review', async () => {
    expect(
      await runHint(
        hint,
        page({
          '@type': 'Review',
          itemReviewed: { '@type': 'Thing', name: 'X' },
          reviewRating: { '@type': 'Rating', ratingValue: 5 },
        }),
      ),
    ).toEqual([]);
  });
});
