import { describe, expect, it } from '@jest/globals';

import { createDatabase, getDatabase } from '@/domain/db/client';
import { domains } from '@/domain/db/schema';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../lib/core/db/sqlite-d1';

describe('createDatabase', () => {
  it('keeps the binding it was given as $client', () => {
    const { d1 } = sqliteD1();
    expect(createDatabase(d1).$client).toBe(d1);
  });

  it('knows every table the schema exports', async () => {
    const { d1 } = sqliteD1();
    const exported = Object.keys(await import('@/domain/db/schema'));
    expect(Object.keys(createDatabase(d1).query).toSorted()).toEqual(
      exported.toSorted(),
    );
  });

  it('knows the app’s tables for relational queries', async () => {
    const { d1 } = sqliteD1(...APP_MIGRATIONS);
    expect(await createDatabase(d1).query.domains.findMany()).toEqual([]);
  });
});

describe('getDatabase', () => {
  it('runs against the request’s DB binding', async () => {
    const { d1, raw } = sqliteD1(...APP_MIGRATIONS);
    raw
      .prepare(
        "INSERT INTO domains (id, user_id, host, created_at, updated_at) VALUES ('d1', 1, 'example.com', 'now', 'now')",
      )
      .run();
    const restore = installCloudflareContext(d1);
    try {
      const rows = await getDatabase().select().from(domains);
      expect(rows.map((row) => row.host)).toEqual(['example.com']);
    } finally {
      restore();
    }
  });
});
