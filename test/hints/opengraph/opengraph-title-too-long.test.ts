import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-title-too-long.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-title-too-long', () => {
  it('passes at 60 characters', async () => {
    expect(
      await runHint(
        hint,
        page(
          '<meta property="og:title" content="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">',
        ),
      ),
    ).toEqual([]);
  });

  it('reports 61 characters', async () => {
    const problems = await runHint(
      hint,
      page(
        '<meta property="og:title" content="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">',
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('61 characters');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/title-too-long',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.warning);
  });

  it('passes without og:title', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });

  it('carries the offending tag and its location', async () => {
    const [problem] = await runHint(
      hint,
      page(
        '<meta property="og:title" content="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">',
      ),
    );
    expect(problem.sourceCode).toContain(
      '<meta property="og:title" content="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">',
    );
    expect(problem.location.line).toBeGreaterThanOrEqual(0);
  });
});
