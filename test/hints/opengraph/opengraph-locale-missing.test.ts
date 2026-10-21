import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-locale-missing.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-locale-missing', () => {
  it('passes with og:locale', async () => {
    expect(
      await runHint(hint, page('<meta property="og:locale" content="en_US">')),
    ).toEqual([]);
  });

  it('reports a missing og:locale', async () => {
    const problems = await runHint(hint, page(''));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no og:locale');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/missing-og-locale',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.hint);
  });
});
