import { describe, expect, it } from '@jest/globals';
import { spawn as nodeSpawn } from 'node:child_process';

import { spawn } from '../../src/node/child-process.js';

describe('#child_process under Node', () => {
  it('is Node own spawn', () => {
    expect(spawn).toBeDefined();
    expect(spawn).toBe(nodeSpawn);
  });
});
