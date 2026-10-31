import { describe, expect, it } from '@jest/globals';
import { HintScope as Real } from 'hint';

import { HintScope } from '../../src/browser/hint.js';

describe('HintScope', () => {
  it('has the values of webhint own enum', () => {
    expect({ ...HintScope }).toEqual({ ...Real });
  });
});
