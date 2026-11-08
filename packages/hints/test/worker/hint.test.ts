import { describe, expect, it } from '@jest/globals';
import { HintScope as WebhintScope } from 'hint';

import { HintScope } from '../../src/worker/hint.js';

describe('HintScope for a runtime that cannot load webhint', () => {
  it('has the scope names and values webhint has, so a hint means the same in both', () => {
    expect({ ...HintScope }).toEqual({ ...WebhintScope });
    expect(HintScope.site).toBe('site');
    expect(HintScope.local).toBe('local');
    expect(HintScope.any).toBe('any');
  });
});
