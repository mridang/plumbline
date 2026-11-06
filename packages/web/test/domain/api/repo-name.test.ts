import { describe, expect, it } from '@jest/globals';

import { repoOf } from '@/domain/api/repo-name';

describe('repoOf', () => {
  it('joins a GitHub owner and name, and refuses what cannot be one', () => {
    expect(repoOf('acme', 'site.js')).toBe('acme/site.js');
    expect(repoOf('', 'site')).toBeNull();
    expect(repoOf('ac me', 'site')).toBeNull();
    expect(repoOf('acme', '..')).toBeNull();
    expect(repoOf('acme', 'a/b')).toBeNull();
    expect(repoOf('-'.repeat(40), 'site')).toBeNull();
  });
});
