import { is } from 'drizzle-orm';
import { SQLiteTable, getTableConfig } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import * as schema from '@/domain/db/schema';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

/** The column names SQLite reports for a table, sorted. */
function columnsOf(raw: DatabaseSync, table: string): readonly string[] {
  return raw
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((row) => String(row['name']))
    .toSorted();
}

/** The names of the indexes SQLite reports for a table. */
function indexesOf(raw: DatabaseSync, table: string): readonly string[] {
  return raw
    .prepare(`PRAGMA index_list(${table})`)
    .all()
    .map((row) => String(row['name']));
}

/** The drizzle tables of the schema file, by their SQL name. */
const tables = new Map(
  Object.values(schema)
    .filter((value) => is(value, SQLiteTable))
    .map((table) => [getTableConfig(table).name, table] as const),
);

/**
 * Tables the migrations create that Drizzle never queries: `rate_limits` is
 * read and written by `lib/rate-limit` in raw SQL, so the schema leaves it out.
 */
const RAW_SQL_TABLES = new Set(['rate_limits']);

/** The names in `sqlite_master` of one type, without SQLite's own and the raw-SQL tables'. */
function namesOf(raw: DatabaseSync, type: 'table' | 'index'): string[] {
  return raw
    .prepare(
      "SELECT name, tbl_name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all(type)
    .filter((row) => !RAW_SQL_TABLES.has(String(row['tbl_name'])))
    .map((row) => String(row['name']));
}

describe('the schema file and the migrations', () => {
  const { raw } = sqliteD1(...APP_MIGRATIONS);

  it('finds the tables of the schema', () => {
    expect(tables.size).toBeGreaterThan(0);
  });

  it('declares every table the migrations create for Drizzle', () => {
    expect(namesOf(raw, 'table')).toEqual([...tables.keys()].toSorted());
  });

  it('declares every index the migrations create', () => {
    // A unique constraint's automatic index is named by SQLite, not declared.
    const declared = [...tables.values()]
      .flatMap((table) =>
        getTableConfig(table).indexes.map((index) => index.config.name),
      )
      .filter((name) => !name.startsWith('sqlite_'));
    expect(namesOf(raw, 'index')).toEqual(declared.toSorted());
  });

  it.each([...tables.keys()])(
    'declares the table %s with the columns and indexes the migrations create',
    (name) => {
      const table = tables.get(name);
      expect(table).toBeDefined();
      const config = getTableConfig(table!);
      expect(columnsOf(raw, name)).toEqual(
        config.columns.map((column) => column.name).toSorted(),
      );
      // Every index the schema names exists (the database also carries the
      // automatic ones SQLite makes for primary keys and unique constraints).
      const present = indexesOf(raw, name);
      config.indexes.forEach((index) =>
        expect(present).toContain(index.config.name),
      );
    },
  );
});
