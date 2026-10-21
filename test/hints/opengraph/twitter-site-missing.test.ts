import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/twitter-site-missing.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('twitter-site-missing', () => {
  it('passes with twitter:site', async () => {
    expect(
      await runHint(
        hint,
        page('<meta name="twitter:site" content="@example">'),
      ),
    ).toEqual([]);
  });

  it('reports a missing twitter:site', async () => {
    const problems = await runHint(hint, page(''));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no twitter:site');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/missing-twitter-site',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.hint);
  });

  it('carries the head and the tag to add', async () => {
    const [problem] = await runHint(hint, page(''));
    expect(problem.sourceCode).toBe(
      '<meta name="twitter:site" content="@yourhandle">',
    );
    expect(problem.location.line).toBeGreaterThanOrEqual(0);
  });
});
