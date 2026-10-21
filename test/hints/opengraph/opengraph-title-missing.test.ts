import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-title-missing.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-title-missing', () => {
  it('passes with og:title', async () => {
    expect(
      await runHint(
        hint,
        page('<meta property="og:title" content="A fine title for sharing">'),
      ),
    ).toEqual([]);
  });

  it('reports a missing og:title', async () => {
    const problems = await runHint(hint, page(''));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no og:title');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/missing-og-title',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.error);
  });

  it('treats an empty og:title as missing', async () => {
    const problems = await runHint(
      hint,
      page('<meta property="og:title" content="">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no og:title');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/missing-og-title',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.error);
  });
});
