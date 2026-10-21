import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/twitter-image-missing.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('twitter-image-missing', () => {
  it('passes with twitter:image', async () => {
    expect(
      await runHint(
        hint,
        page('<meta name="twitter:image" content="https://example.com/i.png">'),
      ),
    ).toEqual([]);
  });

  it('passes with only the og:image fallback', async () => {
    expect(
      await runHint(
        hint,
        page('<meta property="og:image" content="https://example.com/i.png">'),
      ),
    ).toEqual([]);
  });

  it('reports a missing twitter:image', async () => {
    const problems = await runHint(hint, page(''));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain(
      'no twitter:image meta tag and no og:image',
    );
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/missing-twitter-image',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.warning);
  });
});
