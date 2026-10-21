import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/twitter-title-missing.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('twitter-title-missing', () => {
  it('passes with twitter:title', async () => {
    expect(
      await runHint(hint, page('<meta name="twitter:title" content="T">')),
    ).toEqual([]);
  });

  it('reports a missing twitter:title', async () => {
    const problems = await runHint(hint, page(''));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no twitter:title');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/missing-twitter-title',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.warning);
  });
});
