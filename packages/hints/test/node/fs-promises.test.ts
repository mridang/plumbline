import { describe, expect, it } from '@jest/globals';
import {
  mkdtemp as nodeMkdtemp,
  rm as nodeRm,
  writeFile as nodeWriteFile,
} from 'node:fs/promises';

import { mkdtemp, rm, writeFile } from '../../src/node/fs-promises.js';

describe('#fs/promises under Node', () => {
  it('is Node own mkdtemp', () => {
    expect(mkdtemp).toBeDefined();
    expect(mkdtemp).toBe(nodeMkdtemp);
  });

  it('is Node own rm', () => {
    expect(rm).toBeDefined();
    expect(rm).toBe(nodeRm);
  });

  it('is Node own writeFile', () => {
    expect(writeFile).toBeDefined();
    expect(writeFile).toBe(nodeWriteFile);
  });
});
