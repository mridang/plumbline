import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-image-missing.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-image-missing', () => {
  it('passes with og:image', async () => {
    expect(
      await runHint(
        hint,
        page('<meta property="og:image" content="https://example.com/i.png">'),
      ),
    ).toEqual([]);
  });

  it('reports a missing og:image', async () => {
    const problems = await runHint(hint, page(''));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no og:image');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/missing-og-image',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.error);
  });
});
