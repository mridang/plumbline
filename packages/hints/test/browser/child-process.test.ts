import { describe, expect, it } from '@jest/globals';

import { spawn } from '../../src/browser/child-process.js';
import { takeRefusals } from '../../src/browser/refusals.js';

describe('spawn', () => {
  it('refuses to start a program, noting it', () => {
    takeRefusals();
    expect(() => spawn()).toThrow(
      'A browser cannot start a program such as openssl.',
    );
    expect([...takeRefusals()]).toEqual(['process']);
  });
});
