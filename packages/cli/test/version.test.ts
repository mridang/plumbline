import { describe, expect, it } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { packageVersion } from '../src/version.js';

describe('packageVersion', () => {
  it('reads the version from the package manifest', async () => {
    const manifest = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    expect(packageVersion()).toBe(manifest.version);
  });
});
