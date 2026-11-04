import { describe, expect, it } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';

const PACKAGE = new URL('../../', import.meta.url);

describe('bin/run.js', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('package.json', PACKAGE), 'utf8'),
  ) as { bin: Record<string, string> };

  it('is the plumbline executable, named without a leading ./ as npm requires', () => {
    expect(manifest.bin).toEqual({ plumbline: 'bin/run.js' });
  });

  it('exists and starts with a node shebang', () => {
    const file = new URL(manifest.bin['plumbline'], PACKAGE);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8').startsWith('#!/usr/bin/env node')).toBe(
      true,
    );
  });
});
