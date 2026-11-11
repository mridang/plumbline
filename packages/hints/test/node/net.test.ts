import { describe, expect, it } from '@jest/globals';
import { connect as nodeConnect, isIP as nodeIsIP } from 'node:net';

import { connect, isIP } from '../../src/node/net.js';

describe('#net under Node', () => {
  it('is Node own isIP', () => {
    expect(isIP).toBeDefined();
    expect(isIP).toBe(nodeIsIP);
  });

  it('is Node own connect', () => {
    expect(connect).toBeDefined();
    expect(connect).toBe(nodeConnect);
  });
});
