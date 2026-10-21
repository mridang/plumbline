import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/twitter-card-not-large.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('twitter-card-not-large', () => {
  it('passes with summary_large_image', async () => {
    expect(
      await runHint(
        hint,
        page('<meta name="twitter:card" content="summary_large_image">'),
      ),
    ).toEqual([]);
  });

  it('reports summary', async () => {
    const problems = await runHint(
      hint,
      page(
        '<meta name="twitter:card" content="summary"><meta property="og:image" content="https://example.com/i.png">',
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('is summary');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/twitter-card-not-large',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.hint);
  });

  it('passes with summary when the page has no image', async () => {
    expect(
      await runHint(hint, page('<meta name="twitter:card" content="summary">')),
    ).toEqual([]);
  });

  it('passes without twitter:card', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });

  it('passes with player', async () => {
    expect(
      await runHint(hint, page('<meta name="twitter:card" content="player">')),
    ).toEqual([]);
  });
});
