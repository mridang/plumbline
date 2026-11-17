import { readFile } from 'node:fs/promises';

/**
 * The CLI's version, read from its own `package.json` (one directory above
 * both `src/` and `dist/`), which the lockstep release stamps on every
 * publish. It is also the `scannerVersion` written into JSON reports.
 */
export async function packageVersion(): Promise<string> {
  const raw = await readFile(
    new URL('../package.json', import.meta.url),
    'utf8',
  );
  const manifest: unknown = JSON.parse(raw);
  const version =
    typeof manifest === 'object' && manifest !== null && 'version' in manifest
      ? manifest.version
      : undefined;
  return typeof version === 'string' ? version : 'dev';
}
