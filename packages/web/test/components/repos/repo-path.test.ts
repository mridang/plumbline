import { describe, expect, it } from '@jest/globals';

import { repoPath } from '@/components/repos/repo-path';

describe('repoPath', () => {
  it('is /repos/{owner}/{name}', () => {
    expect(repoPath('acme/site')).toBe('/repos/acme/site');
  });

  it('encodes each part, keeping the slash between them', () => {
    expect(repoPath('ac me/si te')).toBe('/repos/ac%20me/si%20te');
  });
});
