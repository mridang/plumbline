import { describe, expect, it } from '@jest/globals';
import { readFile } from 'node:fs/promises';

import { pathExists } from '../helpers/fs.js';

const PACKAGE = new URL('../../', import.meta.url);
const MANIFEST = JSON.parse(
  await readFile(new URL('package.json', PACKAGE), 'utf8'),
) as { bin: Record<string, string> };

describe('bin/run.js', () => {
  const manifest = MANIFEST;

  it('is the plumbline executable, named without a leading ./ as npm requires', () => {
    expect(manifest.bin).toEqual({ plumbline: 'bin/run.js' });
  });

  it('exists and starts with a node shebang', async () => {
    const file = new URL(manifest.bin['plumbline'], PACKAGE);
    expect(await pathExists(file)).toBe(true);
    const text = await readFile(file, 'utf8');
    expect(text.startsWith('#!/usr/bin/env node')).toBe(true);
  });
});
