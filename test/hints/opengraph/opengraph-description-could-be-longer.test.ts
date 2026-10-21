import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-description-could-be-longer.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-description-could-be-longer', () => {
  it('reports 50 characters', async () => {
    const problems = await runHint(
      hint,
      page(
        '<meta property="og:description" content="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">',
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('50 characters');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/description-could-be-longer',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.hint);
  });

  it('reports 70 characters', async () => {
    const problems = await runHint(
      hint,
      page(
        '<meta property="og:description" content="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">',
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('70 characters');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/description-could-be-longer',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.hint);
  });

  it('passes at 49 characters', async () => {
    expect(
      await runHint(
        hint,
        page(
          '<meta property="og:description" content="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">',
        ),
      ),
    ).toEqual([]);
  });

  it('passes at 71 characters', async () => {
    expect(
      await runHint(
        hint,
        page(
          '<meta property="og:description" content="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">',
        ),
      ),
    ).toEqual([]);
  });

  it('carries the offending tag and its location', async () => {
    const [problem] = await runHint(
      hint,
      page(
        '<meta property="og:description" content="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">',
      ),
    );
    expect(problem.sourceCode).toContain(
      '<meta property="og:description" content="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">',
    );
    expect(problem.location.line).toBeGreaterThanOrEqual(0);
  });
});
