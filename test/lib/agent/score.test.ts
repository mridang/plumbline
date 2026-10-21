import { describe, expect, it } from '@jest/globals';
import { CHECKS } from '../../../src/lib/agent/checks.js';
import {
  CATEGORY_WEIGHTS,
  LEVELS,
  computeScore,
  levelFor,
} from '../../../src/lib/agent/score.js';
import type { CheckResult } from '../../../src/lib/agent/types.js';

/** Results where exactly the given ids pass. */
const results = (passing: string[]): CheckResult[] =>
  CHECKS.map((c) => ({
    id: c.id,
    category: c.category,
    passed: passing.includes(c.id),
    detail: '',
  }));

describe('weights and levels', () => {
  it('the four always-counted weights sum to 1 and commerce has its own', () => {
    const { commerce, ...rest } = CATEGORY_WEIGHTS;
    expect(Object.values(rest).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(commerce).toBeGreaterThan(0);
  });
  it('levels are ordered and cover 0', () => {
    expect(LEVELS[0].min).toBe(0);
    expect([...LEVELS].sort((a, b) => a.min - b.min)).toEqual(LEVELS);
  });
  it('maps scores to levels', () => {
    expect(levelFor(0).level).toBe(0);
    expect(levelFor(27)).toMatchObject({
      level: 1,
      name: 'Basic Web Presence',
    });
    expect(levelFor(100).level).toBe(4);
  });
});

describe('computeScore', () => {
  it('reproduces the chowdown scan: 27, level 1', () => {
    // Discoverability 2/4, Bot Access 1/2, API/Auth/MCP 1/8, Content 0/1.
    const r = computeScore(
      results([
        'agent-robots-txt',
        'agent-sitemap',
        'agent-ai-bot-rules',
        'agent-oauth-discovery',
      ]),
      false,
    );
    const by = Object.fromEntries(r.categories.map((c) => [c.category, c]));
    expect(by.discoverability).toMatchObject({
      score: 50,
      passed: 2,
      total: 4,
    });
    expect(by.content).toMatchObject({ score: 0, passed: 0, total: 1 });
    expect(by['bot-access']).toMatchObject({ score: 50, passed: 1, total: 2 });
    expect(by.discovery).toMatchObject({ score: 13, passed: 1, total: 8 });
    expect(by.commerce.counted).toBe(false);
    expect(r.score).toBe(27);
    expect(r.level).toMatchObject({ level: 1, name: 'Basic Web Presence' });
  });
  it('does not count unscored checks', () => {
    const r = computeScore(
      results(['agent-web-bot-auth', 'agent-ard', 'agent-poppy']),
      false,
    );
    expect(r.score).toBe(0);
  });
  it('scores 100 when every scored check passes', () => {
    expect(computeScore(results(CHECKS.map((c) => c.id)), true).score).toBe(
      100,
    );
  });
  it('ignores commerce unless commerce was detected', () => {
    const passing = CHECKS.filter((c) => c.category !== 'commerce').map(
      (c) => c.id,
    );
    expect(computeScore(results(passing), false).score).toBe(100);
    const withShop = computeScore(results(passing), true);
    expect(withShop.score).toBeLessThan(100);
    expect(
      withShop.categories.find((c) => c.category === 'commerce')?.counted,
    ).toBe(true);
  });
  it('is 0 for no results', () => {
    expect(computeScore([], false).score).toBe(0);
  });
});
