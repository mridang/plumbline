import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { DELETE, GET, dynamic } from '@/app/api/users/self/route';
import { SESSION_COOKIE } from '@/domain/auth/app';
import { APP_MIGRATIONS } from '../../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../../lib/core/db/sqlite-d1';
import {
  SESSION_SECRET,
  tokenFor,
} from '../../../../domain/auth/auth-test-kit';

const URL = 'https://plumbline.test/api/users/self';

let raw: DatabaseSync;
let restore: () => void;
/** The Cookie header of the signed-in caller. */
let cookie: string;

beforeEach(async () => {
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1, { SESSION_SECRET });
  raw
    .prepare(
      "INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (7, 'g7', 'a@b.com', '2026-01-01', 'now'), (8, 'g8', 'c@d.com', 'now', 'now')",
    )
    .run();
  raw
    .prepare(
      "INSERT INTO domains (id, user_id, host, created_at, updated_at) VALUES ('d7', 7, 'example.com', 'now', 'now'), ('d8', 8, 'example.com', 'now', 'now')",
    )
    .run();
  cookie = `${SESSION_COOKIE}=${await tokenFor({ id: 7 }, { ep: 0 })}`;
});

afterEach(() => restore());

/** A DELETE of the account with the given headers. */
const remove = (headers: Record<string, string>) =>
  DELETE(new Request(URL, { method: 'DELETE', headers }));

/** The ids left in a table, sorted. */
const left = (table: string) =>
  raw
    .prepare(`SELECT id FROM ${table} ORDER BY id`)
    .all()
    .map((row) => String(row['id']));

describe('GET /api/users/self', () => {
  it('is never prerendered', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('answers the account the session cookie names', async () => {
    const res = await GET(new Request(URL, { headers: { cookie } }));
    expect(await res.json()).toEqual({
      email: 'a@b.com',
      created_at: '2026-01-01',
    });
  });

  it('answers 401 without a session cookie', async () => {
    expect((await GET(new Request(URL))).status).toBe(401);
  });
});

describe('DELETE /api/users/self', () => {
  it('answers 204', async () => {
    expect((await remove({ cookie })).status).toBe(204);
  });

  it('clears the session cookie', async () => {
    const res = await remove({ cookie });
    expect(res.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=;`);
  });

  it('deletes the account', async () => {
    await remove({ cookie });
    expect(left('users')).toEqual(['8']);
  });

  it('deletes the person’s domains and nobody else’s', async () => {
    await remove({ cookie });
    expect(left('domains')).toEqual(['d8']);
  });

  it('answers 401 without a session cookie', async () => {
    expect((await remove({})).status).toBe(401);
  });

  it('answers 401 once the session has been ended everywhere', async () => {
    raw.prepare('UPDATE users SET session_epoch = 1 WHERE id = 7').run();
    expect((await remove({ cookie })).status).toBe(401);
  });

  it('deletes nothing for a request from another site', async () => {
    await remove({ cookie, 'sec-fetch-site': 'cross-site' });
    expect(left('users')).toEqual(['7', '8']);
  });
});
