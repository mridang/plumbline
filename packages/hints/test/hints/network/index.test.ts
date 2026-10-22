import { describe, expect, it } from '@jest/globals';
import { networkHints } from '../../../src/hints/network/index.js';

describe('networkHints', () => {
  it('lists every hint once, all in the internetnl group', () => {
    const ids = networkHints.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(16);
    for (const h of networkHints) {
      expect(h.groups).toContain('internetnl');
    }
  });
});
