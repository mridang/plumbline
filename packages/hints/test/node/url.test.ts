import { describe, expect, it } from '@jest/globals';
import * as node from 'node:url';

import * as ours from '../../src/node/url.js';

describe('#url under Node', () => {
  it.each(['domainToASCII'] as const)('is Node own %s', (name) => {
    expect(ours[name]).toBeDefined();
    expect(ours[name]).toBe(node[name]);
  });
});
