import { describe, expect, it } from '@jest/globals';
import { request as nodeRequest } from 'node:https';

import { request } from '../../src/node/https.js';

describe('#https under Node', () => {
  it('is Node own request', () => {
    expect(request).toBeDefined();
    expect(request).toBe(nodeRequest);
  });
});
