import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-description-slightly-long.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-description-slightly-long', () => {
  it('passes at 160 characters', async () => {
    expect(
      await runHint(
        hint,
        page(
          '<meta property="og:description" content="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">',
        ),
      ),
    ).toEqual([]);
  });

  it('reports 161 characters', async () => {
    const problems = await runHint(
      hint,
      page(
        '<meta property="og:description" content="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">',
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('161 characters');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/description-slightly-long',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.hint);
  });

  it('reports 200 characters', async () => {
    const problems = await runHint(
      hint,
      page(
        '<meta property="og:description" content="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">',
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('200 characters');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/description-slightly-long',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.hint);
  });

  it('passes at 201 characters', async () => {
    expect(
      await runHint(
        hint,
        page(
          '<meta property="og:description" content="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">',
        ),
      ),
    ).toEqual([]);
  });
});
