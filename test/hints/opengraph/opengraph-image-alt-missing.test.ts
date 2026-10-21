import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-image-alt-missing.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-image-alt-missing', () => {
  it('passes with alt', async () => {
    expect(
      await runHint(
        hint,
        page(
          '<meta property="og:image" content="/i.png"><meta property="og:image:alt" content="A red bicycle">',
        ),
      ),
    ).toEqual([]);
  });

  it('reports missing alt', async () => {
    const problems = await runHint(
      hint,
      page('<meta property="og:image" content="/i.png">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no og:image:alt');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/missing-og-image-alt',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.hint);
  });

  it('passes without og:image', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });

  it('carries the head and the tag to add', async () => {
    const [problem] = await runHint(
      hint,
      page('<meta property="og:image" content="/i.png">'),
    );
    expect(problem.sourceCode).toBe(
      '<meta property="og:image:alt" content="Describe the image">',
    );
    expect(problem.location.line).toBeGreaterThanOrEqual(0);
  });
});
