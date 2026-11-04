import { describe, expect, it } from '@jest/globals';
import * as node from 'node:https';

import * as ours from '../../src/node/https.js';

describe('#https under Node', () => {
  it.each(['request'] as const)('is Node own %s', (name) => {
    expect(ours[name]).toBeDefined();
    expect(ours[name]).toBe(node[name]);
  });
});
