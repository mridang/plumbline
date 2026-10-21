import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-description-missing.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-description-missing', () => {
  it('passes with og:description', async () => {
    expect(
      await runHint(
        hint,
        page('<meta property="og:description" content="A description">'),
      ),
    ).toEqual([]);
  });

  it('reports a missing og:description', async () => {
    const problems = await runHint(hint, page(''));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no og:description');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/missing-og-description',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.error);
  });
});
