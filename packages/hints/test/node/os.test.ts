import { describe, expect, it } from '@jest/globals';
import { tmpdir as nodeTmpdir } from 'node:os';

import { tmpdir } from '../../src/node/os.js';

describe('#os under Node', () => {
  it('is Node own tmpdir', () => {
    expect(tmpdir).toBeDefined();
    expect(tmpdir).toBe(nodeTmpdir);
  });
});
