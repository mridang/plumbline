import { describe, expect, it } from '@jest/globals';

import { request } from '../../src/browser/http.js';
import { takeRefusals } from '../../src/browser/refusals.js';

describe('request', () => {
  it('refuses a raw HTTP request, noting a socket', () => {
    takeRefusals();
    expect(() => request()).toThrow(
      'A browser cannot make a raw HTTP request.',
    );
    expect([...takeRefusals()]).toEqual(['socket']);
  });
});
