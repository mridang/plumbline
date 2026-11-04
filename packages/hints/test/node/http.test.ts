import { describe, expect, it } from '@jest/globals';
import * as node from 'node:http';

import * as ours from '../../src/node/http.js';

describe('#http under Node', () => {
  it.each(['request'] as const)('is Node own %s', (name) => {
    expect(ours[name]).toBeDefined();
    expect(ours[name]).toBe(node[name]);
  });
});
