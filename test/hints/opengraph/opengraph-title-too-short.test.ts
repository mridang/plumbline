import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-title-too-short.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-title-too-short', () => {
  it('passes at 15 characters', async () => {
    expect(
      await runHint(
        hint,
        page('<meta property="og:title" content="xxxxxxxxxxxxxxx">'),
      ),
    ).toEqual([]);
  });

  it('reports 14 characters', async () => {
    const problems = await runHint(
      hint,
      page('<meta property="og:title" content="xxxxxxxxxxxxxx">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('14 characters');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/title-too-short',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.hint);
  });

  it('passes without og:title', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });
});
