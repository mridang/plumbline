import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/richresults/richresults-article.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './helper.js';

describe('richresults-article', () => {
  it('does nothing when no Article node is present', async () => {
    expect(await runHint(hint, page({ '@type': 'WebPage' }))).toEqual([]);
  });

  it('only warns for a bare NewsArticle (no required fields)', async () => {
    const problems = await runHint(hint, page({ '@type': 'NewsArticle' }));
    expect(problems).toHaveLength(4);
    expect(problems.every((p) => p.severity === Severity.warning)).toBe(true);
  });

  it('passes a complete BlogPosting', async () => {
    expect(
      await runHint(
        hint,
        page({
          '@type': 'BlogPosting',
          headline: 'H',
          image: 'i.jpg',
          datePublished: '2026-01-01',
          author: { '@type': 'Person', name: 'A' },
        }),
      ),
    ).toEqual([]);
  });
});
