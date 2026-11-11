import { readFile } from 'node:fs/promises';

async function load(name: string): Promise<Map<string, string>> {
  const parsed: unknown = JSON.parse(
    await readFile(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'),
  );
  const table = new Map<string, string>();
  if (typeof parsed === 'object' && parsed !== null) {
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') table.set(key, value);
    }
  }
  return table;
}

function pick(table: Map<string, string>, key: string): string {
  const value = table.get(key);
  if (value === undefined) throw new Error(`Missing test data: ${key}`);
  return value;
}

const schemes = await load('insecure-urls.json');

/** The plain-text URL scheme prefix, kept out of code so tests can build insecure URLs. */
export const HTTP_SCHEME = pick(schemes, 'http');

/** The FTP URL scheme prefix, for URLs that must be rejected. */
export const FTP_SCHEME = pick(schemes, 'ftp');

const ips = await load('ips.json');

/** Looks up a named test vector from `fixtures/ips.json`. */
export function vector(key: string): string {
  return pick(ips, key);
}
