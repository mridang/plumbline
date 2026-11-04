import { describe, expect, it } from '@jest/globals';
import * as node from 'node:net';

import * as ours from '../../src/node/net.js';

describe('#net under Node', () => {
  it.each(['isIP', 'connect'] as const)('is Node own %s', (name) => {
    expect(ours[name]).toBeDefined();
    expect(ours[name]).toBe(node[name]);
  });
});
