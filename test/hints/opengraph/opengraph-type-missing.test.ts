import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-type-missing.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-type-missing', () => {
  it('passes with og:type', async () => {
    expect(
      await runHint(hint, page('<meta property="og:type" content="website">')),
    ).toEqual([]);
  });

  it('reports a missing og:type', async () => {
    const problems = await runHint(hint, page(''));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no og:type');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/missing-og-type',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.hint);
  });
});
