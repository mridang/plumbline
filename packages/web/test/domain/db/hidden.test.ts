import { describe, expect, it } from '@jest/globals';

import { ACCESS_TTL_MS, replaceAccess } from '@/domain/db/access';
import { addDomain } from '@/domain/db/domains';
import {
  canSeeRepo,
  hideRepo,
  listHidden,
  unhideRepo,
} from '@/domain/db/hidden';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

const empty = () => sqliteDatabase(...APP_MIGRATIONS).db;

describe('hiding a repository', () => {
  it('lists the repositories the person hid, and only theirs', async () => {
    const db = empty();
    await hideRepo(db, 1, 'o/a');
    await hideRepo(db, 1, 'o/b');
    await hideRepo(db, 2, 'o/c');
    expect([...(await listHidden(db, 1))].toSorted()).toEqual(['o/a', 'o/b']);
    expect([...(await listHidden(db, 2))]).toEqual(['o/c']);
  });

  it('hides a repository that is already hidden without complaint', async () => {
    const db = empty();
    await hideRepo(db, 1, 'o/a');
    await hideRepo(db, 1, 'o/a');
    expect([...(await listHidden(db, 1))]).toEqual(['o/a']);
  });

  it('shows it again, and says so when it was not hidden', async () => {
    const db = empty();
    await hideRepo(db, 1, 'o/a');
    expect(await unhideRepo(db, 1, 'o/a')).toBe(true);
    expect(await unhideRepo(db, 1, 'o/a')).toBe(false);
    expect((await listHidden(db, 1)).size).toBe(0);
  });

  it("does not show another person's repository again", async () => {
    const db = empty();
    await hideRepo(db, 1, 'o/a');
    expect(await unhideRepo(db, 2, 'o/a')).toBe(false);
    expect((await listHidden(db, 1)).size).toBe(1);
  });
});

describe('canSeeRepo', () => {
  it('is true for a repository with a site the person added, or one GitHub let them see', async () => {
    const db = empty();
    await addDomain(db, 1, 'mine.example.com', 'o/mine');
    await addDomain(db, 2, 'shared.example.com', 'o/shared');
    await replaceAccess(db, 1, ['o/shared']);
    expect(await canSeeRepo(db, 1, 'o/mine')).toBe(true);
    expect(await canSeeRepo(db, 1, 'o/shared')).toBe(true);
  });

  it("is false for another person's repository, one that does not exist, and access that has lapsed", async () => {
    const db = empty();
    await addDomain(db, 2, 'other.example.com', 'o/other');
    await addDomain(db, 2, 'old.example.com', 'o/old');
    await replaceAccess(db, 1, ['o/old'], '2026-01-01T00:00:00.000Z');
    const later = Date.parse('2026-01-01T00:00:00.000Z') + ACCESS_TTL_MS + 1;
    expect(await canSeeRepo(db, 1, 'o/other', later)).toBe(false);
    expect(await canSeeRepo(db, 1, 'o/nothing', later)).toBe(false);
    expect(await canSeeRepo(db, 1, 'o/old', later)).toBe(false);
  });
});
