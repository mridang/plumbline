import { describe, expect, it } from '@jest/globals';

import { deleteAccountData } from '@/domain/db/account';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

/** Two people, each with a domain, a report and a connected app with a token and a code. */
function seeded() {
  const made = sqliteDatabase(...APP_MIGRATIONS);
  const { raw } = made;
  for (const uid of [1, 2]) {
    raw
      .prepare(
        "INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (?, ?, 'a@b.com', 'now', 'now')",
      )
      .run(uid, `sub-${uid}`);
    raw
      .prepare(
        "INSERT INTO domains (id, user_id, host, created_at, updated_at) VALUES (?, ?, 'example.com', 'now', 'now')",
      )
      .run(`d${uid}`, uid);
    raw
      .prepare(
        "INSERT INTO reports (id, domain_id, user_id, url, passed, warned, failed, skipped, outcomes, created_at) VALUES (?, ?, ?, 'https://example.com/', 0, 0, 0, 0, '[]', 'now')",
      )
      .run(`r${uid}`, `d${uid}`, uid);
    raw
      .prepare(
        "INSERT INTO oauth_grants (id, user_id, client_id, scope, resource, created_at) VALUES (?, ?, 'c1', 'checks:read', 'r', 'now')",
      )
      .run(`g${uid}`, uid);
    raw
      .prepare(
        "INSERT INTO oauth_tokens (token_hash, kind, grant_id, expires_at) VALUES (?, 'access', ?, 0)",
      )
      .run(`t${uid}`, `g${uid}`);
    raw
      .prepare(
        "INSERT INTO oauth_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, scope, resource, expires_at) VALUES (?, 'c1', ?, 'https://a/cb', 'x', 'checks:read', 'r', 0)",
      )
      .run(`k${uid}`, uid);
    raw
      .prepare(
        "INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at) VALUES (?, ?, 'p', 'a', 'now')",
      )
      .run(`https://push.test/${uid}`, uid);
    raw
      .prepare(
        "INSERT INTO live_events (id, user_id, payload, created_at) VALUES (?, ?, '{}', 'now')",
      )
      .run(uid, uid);
  }
  return made;
}

/** The ids left in a table's key column, sorted. */
function left(
  raw: ReturnType<typeof seeded>['raw'],
  table: string,
  column: string,
): string[] {
  return raw
    .prepare(`SELECT ${column} AS id FROM ${table} ORDER BY ${column}`)
    .all()
    .map((row) => String(row['id']));
}

const TABLES = [
  ['users', 'id', ['2']],
  ['domains', 'id', ['d2']],
  ['reports', 'id', ['r2']],
  ['oauth_grants', 'id', ['g2']],
  ['oauth_tokens', 'token_hash', ['t2']],
  ['oauth_codes', 'code_hash', ['k2']],
  ['push_subscriptions', 'endpoint', ['https://push.test/2']],
  ['live_events', 'id', ['2']],
] as const;

describe('deleteAccountData', () => {
  it.each(TABLES)(
    'removes the person’s rows from %s and keeps everyone else’s',
    async (table, column, kept) => {
      const { db, raw } = seeded();
      await deleteAccountData(db, 1);
      expect(left(raw, table, column)).toEqual(kept);
    },
  );

  it('changes nothing for an account that does not exist', async () => {
    const { db, raw } = seeded();
    await deleteAccountData(db, 99);
    expect(left(raw, 'users', 'id')).toEqual(['1', '2']);
  });
});
