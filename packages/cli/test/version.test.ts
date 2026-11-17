import { readFile } from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';
import { packageVersion } from '../src/version.js';

describe('packageVersion', () => {
  it('reads the version from the package manifest', async () => {
    const manifest: unknown = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    );
    expect(manifest).toMatchObject({ version: await packageVersion() });
  });
});
