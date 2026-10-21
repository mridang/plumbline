import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-description-keyword-stuffing.js';
import { runHint } from '../../helpers/run-hint.js';
import { page } from './page.js';

describe('opengraph-description-keyword-stuffing', () => {
  it('passes with natural prose', async () => {
    expect(
      await runHint(
        hint,
        page(
          '<meta property="og:description" content="Handmade leather shoes made to last for many years of daily wear">',
        ),
      ),
    ).toEqual([]);
  });

  it('reports a repeated word', async () => {
    const problems = await runHint(
      hint,
      page(
        '<meta property="og:description" content="cheap shoes buy shoes best shoes online shoes">',
      ),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('repeats the same word');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/description-keyword-stuffing',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.warning);
  });

  it('passes without og:description', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });
});
