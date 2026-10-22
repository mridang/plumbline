import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-url-missing.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-url-missing', () => {
  it('passes with og:url', async () => {
    expect(
      await runHint(
        hint,
        page('<meta property="og:url" content="https://example.com/">'),
      ),
    ).toEqual([]);
  });

  it('reports a missing og:url', async () => {
    const problems = await runHint(hint, page(''));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no og:url');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/missing-og-url',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.warning);
  });

  it('carries the head and the tag to add', async () => {
    const [problem] = await runHint(hint, page(''));
    expect(problem.sourceCode).toBe(
      '<meta property="og:url" content="https://example.com/page">',
    );
    expect(problem.location.line).toBeGreaterThanOrEqual(0);
  });
});
