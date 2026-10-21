import { describe, expect, it } from '@jest/globals';
import { CHECKS, checkById, runCheck } from '../../../src/lib/agent/checks.js';
import { fakeEnv } from './fake-env.js';

describe('CHECKS', () => {
  it('has 22 unique ids that all start with agent-', () => {
    const ids = CHECKS.map((c) => c.id);
    expect(ids).toHaveLength(22);
    expect(new Set(ids).size).toBe(22);
    expect(ids.every((id) => id.startsWith('agent-'))).toBe(true);
  });
  it('leaves Web Bot Auth, ARD and Poppy out of the score', () => {
    expect(CHECKS.filter((c) => !c.scored).map((c) => c.id)).toEqual([
      'agent-web-bot-auth',
      'agent-ard',
      'agent-poppy',
    ]);
  });
  it('runs every check against an empty site without throwing', async () => {
    for (const check of CHECKS) {
      const r = await runCheck(check, fakeEnv());
      expect(r.id).toBe(check.id);
      expect(r.category).toBe(check.category);
      expect(r.passed).toBe(false);
    }
  });
});

describe('checkById', () => {
  it('finds a check and throws for an unknown id', () => {
    expect(checkById('agent-sitemap').category).toBe('discoverability');
    expect(() => checkById('nope')).toThrow('Unknown agent check');
  });
});

describe('runCheck', () => {
  it('turns a throwing check into a failed result', async () => {
    const check = {
      ...checkById('agent-sitemap'),
      run: () => Promise.reject(new Error('boom')),
    };
    const r = await runCheck(check, fakeEnv());
    expect(r.passed).toBe(false);
    expect(r.detail).toContain('boom');
  });
});
