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

  // The queries that run often must be answered from an index: no table scan
  // and no temporary sort. A scan here would read every row on every call.
  it.each([
    [
      'a domain’s reports, newest first',
      "SELECT id FROM reports WHERE domain_id = 'd' ORDER BY created_at DESC, id DESC LIMIT 20",
    ],
    [
      'the reports to prune',
      "DELETE FROM reports WHERE domain_id = 'd' AND (created_at < 'c' OR (created_at = 'c' AND id < 'i'))",
    ],
    [
      'a person’s domains in order',
      'SELECT id FROM domains WHERE user_id = 1 ORDER BY created_at, id',
    ],
    [
      'the sites that are due for a check',
      "SELECT id FROM domains WHERE repo IS NOT NULL AND checked_at < 'x' ORDER BY checked_at LIMIT 10",
    ],
    [
      'the sites of one repository, for its badge',
      "SELECT errors FROM domains WHERE repo = 'acme/site'",
    ],
    [
      'the report already made for a commit',
      "SELECT id FROM preview_reports WHERE repo = 'a/b' AND sha = 'c' AND url = 'u' LIMIT 1",
    ],
    [
      'the repositories a person can see',
      "SELECT repo FROM user_repositories WHERE user_id = 1 AND granted_at > 'x'",
    ],
    [
      'the people who can see a repository',
      "SELECT user_id FROM user_repositories WHERE repo = 'a/b' AND granted_at > 'x' LIMIT 25",
    ],
    [
      'the purge of old preview reports',
      "DELETE FROM preview_reports WHERE created_at < 'x'",
    ],
    [
      'the events a reconnecting dashboard missed',
      'SELECT id, payload FROM live_events WHERE user_id = 1 AND id > 5 ORDER BY id LIMIT 10',
    ],
    [
      'the subscriptions of one person',
      'SELECT endpoint FROM push_subscriptions WHERE user_id = 1',
    ],
    [
      'a site’s server runs, newest first, a page at a time',
      "SELECT id, ran_at FROM suite_runs WHERE user_id = 1 AND host = 'a' AND ran_at < 'x' ORDER BY ran_at DESC, id DESC LIMIT 10",
    ],
    [
      'a domain’s saved reports, newest first, a page at a time',
      "SELECT id, created_at FROM reports WHERE user_id = 1 AND domain_id = 'd' AND created_at < 'x' ORDER BY created_at DESC, id DESC LIMIT 10",
    ],
    [
      'the purge of old webhook deliveries',
      "DELETE FROM webhook_deliveries WHERE received_at < 'x'",
    ],
  ])('answers %s from an index', (_name, sql) => {
    const plan = raw
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .all()
      .map((row) => String(row['detail']));
    expect(plan.join('\n')).toMatch(/USING (COVERING )?(INDEX|PRIMARY KEY)/);
    expect(plan.join('\n')).not.toMatch(/SCAN|TEMP B-TREE/);
  });
});
