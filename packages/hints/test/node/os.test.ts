import { describe, expect, it } from '@jest/globals';
import * as node from 'node:os';

import * as ours from '../../src/node/os.js';

describe('#os under Node', () => {
  it.each(['tmpdir'] as const)('is Node own %s', (name) => {
    expect(ours[name]).toBeDefined();
    expect(ours[name]).toBe(node[name]);
  });
});
