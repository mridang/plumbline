import { describe, expect, it } from '@jest/globals';
import * as node from 'node:child_process';

import * as ours from '../../src/node/child-process.js';

describe('#child_process under Node', () => {
  it.each(['spawn'] as const)('is Node own %s', (name) => {
    expect(ours[name]).toBeDefined();
    expect(ours[name]).toBe(node[name]);
  });
});
