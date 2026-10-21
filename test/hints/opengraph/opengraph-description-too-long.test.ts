import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/opengraph/opengraph-description-too-long.js';
import { runHint } from '../../helpers/run-hint.js';
import type { Routes } from '../../helpers/run-hint.js';
import { page } from './page.js';

const description = (length: number): Routes =>
  page(`<meta property="og:description" content="${'x'.repeat(length)}">`);

describe('opengraph-description-too-long', () => {
  it('passes at 160 characters', async () => {
    expect(await runHint(hint, description(160))).toEqual([]);
  });

  it('reports 161 characters', async () => {
    const problems = await runHint(hint, description(161));
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('161 characters');
    expect(
      problems[0].message.endsWith(
        'https://www.opengraph.to/articles/description-too-long',
      ),
    ).toBe(true);
    expect(problems[0].severity).toBe(Severity.warning);
  });

  it('reports 250 characters', async () => {
    expect(await runHint(hint, description(250))).toHaveLength(1);
  });

  it('passes without og:description', async () => {
    expect(await runHint(hint, page(''))).toEqual([]);
  });
});
