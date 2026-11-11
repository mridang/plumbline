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
  const { version } = JSON.parse(raw) as { version?: unknown };
  return typeof version === 'string' ? version : 'dev';
}
