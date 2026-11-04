import { describe, expect, it } from '@jest/globals';

import {
  ERROR_COST,
  WARNING_COST,
  colourOf,
  repoScore,
  siteScore,
} from '@/domain/badge/score';

const site = (
  state: Parameters<typeof siteScore>[0]['state'],
  errors = 0,
  warnings = 0,
) => ({
  state,
  errors,
  warnings,
});

describe('siteScore', () => {
  it('starts at 100 and loses points for errors and warnings', () => {
    expect(siteScore(site('ok'))).toBe(100);
    expect(siteScore(site('failing', 2, 3))).toBe(
      100 - 2 * ERROR_COST - 3 * WARNING_COST,
    );
  });

  it('never goes below 0', () => {
    expect(siteScore(site('failing', 50))).toBe(0);
  });

  it('is 0 for a site that did not answer and none for one never checked', () => {
    expect(siteScore(site('unreachable'))).toBe(0);
    expect(siteScore(site('unchecked'))).toBeNull();
  });
});

describe('repoScore', () => {
  it('averages the sites that have been checked', () => {
    expect(repoScore([site('ok'), site('failing', 2), site('unchecked')])).toBe(
      Math.round((100 + 70) / 2),
    );
  });

  it('is none when no site has been checked', () => {
    expect(repoScore([])).toBeNull();
    expect(repoScore([site('unchecked')])).toBeNull();
  });
});

describe('colourOf', () => {
  it('is green from 90, yellow from 70, red below, and grey for none', () => {
    expect(colourOf(100)).toBe('#2da44e');
    expect(colourOf(90)).toBe('#2da44e');
    expect(colourOf(89)).toBe('#dbab09');
    expect(colourOf(70)).toBe('#dbab09');
    expect(colourOf(69)).toBe('#cf222e');
    expect(colourOf(null)).toBe('#9f9f9f');
  });
});
