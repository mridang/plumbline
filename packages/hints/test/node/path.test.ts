import { describe, expect, it } from '@jest/globals';

import { join } from '../../src/node/path.js';

describe('#path under Node', () => {
  it('is Node own join', () => {
    expect(join('a', 'b', '..', 'c')).toBe('a/c');
  });
});
