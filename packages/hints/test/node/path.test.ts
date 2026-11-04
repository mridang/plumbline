import { describe, expect, it } from '@jest/globals';
import path from 'node:path';

import { join } from '../../src/node/path.js';

describe('#path under Node', () => {
  it('is Node own join', () => {
    expect(join).toBe(path.join);
  });
});
