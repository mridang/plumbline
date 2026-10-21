import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-description-same-as-title.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-description-same-as-title', () => {
  it('passes with different texts', async () => {
    expect(
      await runHint(
        hint,
        page(
          '<meta property="og:title" content="A title"><meta property="og:description" content="A longer description">',
        ),
      ),
    ).toEqual([]);
  });

  it('reports identical texts', async () => {
    const problems = await runHint(
      hint,
      page(
        '<meta property="og:title" content="Same words"><meta property="og:description" content="Same words">',
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('same as the og:title');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/description-same-as-title',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.warning);
  });

  it('ignores case and spacing', async () => {
    const problems = await runHint(
      hint,
      page(
        '<meta property="og:title" content="Same  Words"><meta property="og:description" content=" same words">',
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('same as the og:title');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/description-same-as-title',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.warning);
  });

  it('passes without a title', async () => {
    expect(
      await runHint(
        hint,
        page('<meta property="og:description" content="Only this">'),
      ),
    ).toEqual([]);
  });

  it('carries the offending tag and its location', async () => {
    const [problem] = await runHint(
      hint,
      page(
        '<meta property="og:title" content="Same words here for both"><meta property="og:description" content="Same words here for both">',
      ),
    );
    expect(problem.sourceCode).toContain(
      '<meta property="og:description" content="Same words here for both">',
    );
    expect(problem.location.line).toBeGreaterThanOrEqual(0);
  });
});
