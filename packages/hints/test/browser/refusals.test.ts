import { describe, expect, it } from '@jest/globals';

import {
  BrowserRefusalError,
  refuse,
  takeRefusals,
} from '../../src/browser/refusals.js';

describe('refuse', () => {
  it('throws, saying what a browser cannot do', () => {
    takeRefusals();
    expect(() => refuse('socket', 'open a raw TCP connection')).toThrow(
      new BrowserRefusalError('socket', 'open a raw TCP connection'),
    );
    expect(() => refuse('socket', 'x')).toThrow('A browser cannot x.');
  });
});

describe('takeRefusals', () => {
  it('hands over what was refused and starts afresh', () => {
    takeRefusals();
    for (const refusal of ['socket', 'crypto', 'socket'] as const) {
      try {
        refuse(refusal, 'do it');
      } catch {
        // Noted either way.
      }
    }
    expect([...takeRefusals()].sort()).toEqual(['crypto', 'socket']);
    expect(takeRefusals().size).toBe(0);
  });
});
