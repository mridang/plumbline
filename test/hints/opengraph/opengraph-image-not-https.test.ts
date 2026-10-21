import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-image-not-https.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-image-not-https', () => {
  it('passes with https', async () => {
    expect(
      await runHint(
        hint,
        page('<meta property="og:image" content="https://example.com/i.png">'),
      ),
    ).toEqual([]);
  });

  it('reports http', async () => {
    const problems = await runHint(
      hint,
      page('<meta property="og:image" content="http://example.com/i.png">'),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('uses http://');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/image-not-https',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.warning);
  });

  it('passes without og:image', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });
});
