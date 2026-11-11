import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const DIRECTORY = path.join(process.cwd(), 'migrations');

/**
 * Every migration file, in order: what a database looks like once all of them
 * have been applied, which is what the schema file in `src/lib/db` mirrors.
 */
const ENTRIES = await readdir(DIRECTORY);
export const APP_MIGRATIONS: readonly string[] = ENTRIES.filter((file) =>
  file.endsWith('.sql'),
).toSorted((a, b) => Number(a > b) - Number(a < b));

/** The SQL of every migration file, read once at import so builders stay synchronous. */
const SQL = new Map(
  await Promise.all(
    APP_MIGRATIONS.map(
      async (file) =>
        [file, await readFile(path.join(DIRECTORY, file), 'utf8')] as const,
    ),
  ),
);

/** The SQL of one migration file of `migrations/`. */
export function migrationSql(file: string): string {
  const sql = SQL.get(file);
  if (sql === undefined) {
    throw new Error(`No migration file named ${file}`);
  }
  return sql;
}
