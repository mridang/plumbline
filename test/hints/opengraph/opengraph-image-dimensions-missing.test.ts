import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-image-dimensions-missing.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-image-dimensions-missing', () => {
  it('passes with both tags', async () => {
    expect(
      await runHint(
        hint,
        page(
          '<meta property="og:image" content="/i.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">',
        ),
      ),
    ).toEqual([]);
  });

  it('reports both missing', async () => {
    const problems = await runHint(
      hint,
      page('<meta property="og:image" content="/i.png">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('og:image:width or og:image:height');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/missing-image-dimensions',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.warning);
  });

  it('reports height missing', async () => {
    const problems = await runHint(
      hint,
      page(
        '<meta property="og:image" content="/i.png"><meta property="og:image:width" content="1200">',
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no og:image:height');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/missing-image-dimensions',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.warning);
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
      '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">',
    );
    expect(problem.location.line).toBeGreaterThanOrEqual(0);
  });
});
