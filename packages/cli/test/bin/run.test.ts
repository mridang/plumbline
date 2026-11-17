import { readFile } from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

import { pathExists } from '../helpers/fs.js';

const PACKAGE = new URL('../../', import.meta.url);
const MANIFEST: unknown = JSON.parse(
  await readFile(new URL('package.json', PACKAGE), 'utf8'),
);

describe('bin/run.js', () => {
  it('is the plumbline executable, named without a leading ./ as npm requires', () => {
    expect(MANIFEST).toEqual(
      expect.objectContaining({ bin: { plumbline: 'bin/run.js' } }),
    );
  });

  it('exists and starts with a node shebang', async () => {
    const file = new URL('bin/run.js', PACKAGE);
    expect(await pathExists(file)).toBe(true);
    const text = await readFile(file, 'utf8');
    expect(text.startsWith('#!/usr/bin/env node')).toBe(true);
  });
});
