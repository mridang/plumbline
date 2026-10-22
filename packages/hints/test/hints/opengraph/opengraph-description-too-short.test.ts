import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-description-too-short.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-description-too-short', () => {
  it('passes at 50 characters', async () => {
    expect(
      await runHint(
        hint,
        page(
          '<meta property="og:description" content="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">',
        ),
      ),
    ).toEqual([]);
  });

  it('reports 49 characters', async () => {
    const problems = await runHint(
      hint,
      page(
        '<meta property="og:description" content="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">',
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('49 characters');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/description-too-short',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.hint);
  });

  it('passes without og:description', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });

  it('carries the offending tag and its location', async () => {
    const [problem] = await runHint(
      hint,
      page('<meta property="og:description" content="short">'),
    );
    expect(problem.sourceCode).toContain(
      '<meta property="og:description" content="short">',
    );
    expect(problem.location.line).toBeGreaterThanOrEqual(0);
  });
});
