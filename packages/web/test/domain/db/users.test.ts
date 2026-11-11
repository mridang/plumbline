import { describe, expect, it } from '@jest/globals';

import {
  bumpSessionEpoch,
  getSessionEpoch,
  getUserById,
  upsertUser,
} from '@/domain/db/users';
import { fakeDb } from '../../lib/core/db/fake-db';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

/** A database with every migration applied and two people in it. */
function seeded() {
  const made = sqliteDatabase(...APP_MIGRATIONS);
  const user = made.raw.prepare(
    "INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (?, ?, ?, '2026-01-01', '2026-01-01')",
  );
  user.run(1, 'sub-1', 'a@b.com');
  user.run(2, 'sub-2', 'c@d.com');
  return made;
}

const saved = { id: 7, email: 'a@b.com' };

/** The `set` the conflict clause of an upsert carries. */
function updateOf(
  calls: readonly { method: string; args: readonly unknown[] }[],
) {
  const conflict = calls.find((c) => c.method === 'onConflictDoUpdate');
  return (conflict?.args[0] as { set: Record<string, unknown> }).set;
}

describe('upsertUser', () => {
  it('returns the saved row', async () => {
    const { db } = fakeDb({ insert: [[saved]] });
    expect(await upsertUser(db, { google_sub: 's', email: 'a@b.com' })).toBe(
      saved,
    );
  });

  it('inserts what it was given and nulls the rest', async () => {
    const { db, calls } = fakeDb({ insert: [[saved]] });
    await upsertUser(db, { google_sub: 's', email: 'a@b.com', name: 'Ann' });
    expect(calls.find((c) => c.method === 'values')?.args[0]).toMatchObject({
      google_sub: 's',
      email: 'a@b.com',
      name: 'Ann',
      picture: null,
    });
  });

  it('on a return visit overwrites only what was supplied', async () => {
    const { db, calls } = fakeDb({ insert: [[saved]] });
    await upsertUser(db, { google_sub: 's', email: 'a@b.com', name: 'Ann' });
    const set = updateOf(calls);
    expect(
      Object.keys(set).toSorted((a, b) => Number(a > b) - Number(a < b)),
    ).toEqual(['email', 'name', 'updated_at']);
  });

  it('throws if the database returns no row', async () => {
    const { db } = fakeDb({ insert: [[]] });
    await expect(
      upsertUser(db, { google_sub: 's', email: 'a@b.com' }),
    ).rejects.toThrow('returned no row');
  });
});

describe('getUserById', () => {
  it('looks the user up', async () => {
    const { db } = fakeDb({ findFirst: { users: saved } });
    expect(await getUserById(db, 7)).toBe(saved);
  });
});

describe('session epoch', () => {
  it('starts at zero, is read back, and is undefined for an account that is gone', async () => {
    const { db } = seeded();
    expect(await getSessionEpoch(db, 1)).toBe(0);
    expect(await getSessionEpoch(db, 99)).toBeUndefined();
  });

  it("moves one person's epoch on and leaves everyone else's", async () => {
    const { db } = seeded();
    await bumpSessionEpoch(db, 1);
    await bumpSessionEpoch(db, 1);
    expect(await getSessionEpoch(db, 1)).toBe(2);
    expect(await getSessionEpoch(db, 2)).toBe(0);
  });

  it('is part of the row a sign-in returns', async () => {
    const { db } = seeded();
    const user = await upsertUser(db, {
      google_sub: 'sub-3',
      email: 'e@f.com',
    });
    expect(user.session_epoch).toBe(0);
  });
});
