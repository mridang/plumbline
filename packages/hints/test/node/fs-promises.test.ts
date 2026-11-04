import { describe, expect, it } from '@jest/globals';
import * as node from 'node:fs/promises';

import * as ours from '../../src/node/fs-promises.js';

describe('#fs/promises under Node', () => {
  it.each(['mkdtemp', 'rm', 'writeFile'] as const)('is Node own %s', (name) => {
    expect(ours[name]).toBeDefined();
    expect(ours[name]).toBe(node[name]);
  });
});
