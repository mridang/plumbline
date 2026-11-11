import { describe, expect, it } from '@jest/globals';
import { request as nodeRequest } from 'node:http';

import { request } from '../../src/node/http.js';

describe('#http under Node', () => {
  it('is Node own request', () => {
    expect(request).toBeDefined();
    expect(request).toBe(nodeRequest);
  });
});
