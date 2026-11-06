import { describe, expect, it } from '@jest/globals';

import { ACCESS_TTL_MS, replaceAccess } from '@/domain/db/access';
import {
  canSeeRepo,
  disableRepo,
  disabledRepos,
  enableRepo,
  isRepoDisabled,
  stopChecking,
} from '@/domain/db/disabled';
import { addDomain } from '@/domain/db/domains';
import { markChecking } from '@/domain/db/live';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

const made = () => sqliteDatabase(...APP_MIGRATIONS);
const empty = () => made().db;

describe('turning checks off', () => {
  it('says whether a repository is off, and only that one', async () => {
    const db = empty();
    expect(await isRepoDisabled(db, 'o/a')).toBe(false);
    await disableRepo(db, 1, 'o/a');
    expect(await isRepoDisabled(db, 'o/a')).toBe(true);
    expect(await isRepoDisabled(db, 'o/b')).toBe(false);
  });

  it('says whether it changed anything, so a second request does no more', async () => {
    const db = empty();
    expect(await disableRepo(db, 1, 'o/a')).toBe(true);
    expect(await disableRepo(db, 2, 'o/a')).toBe(false);
    expect(await enableRepo(db, 'o/a')).toBe(true);
    expect(await enableRepo(db, 'o/a')).toBe(false);
    expect(await isRepoDisabled(db, 'o/a')).toBe(false);
  });

  it('lists the repositories off that the person can see, theirs or shared with them', async () => {
    const db = empty();
    await addDomain(db, 1, 'a.test', 'o/mine');
    await addDomain(db, 2, 'b.test', 'o/shared');
    await addDomain(db, 2, 'c.test', 'o/private');
    await replaceAccess(db, 1, ['o/shared']);
    await disableRepo(db, 2, 'o/mine');
    await disableRepo(db, 2, 'o/shared');
    await disableRepo(db, 2, 'o/private');
    expect([...(await disabledRepos(db, 1))].toSorted()).toEqual([
      'o/mine',
      'o/shared',
    ]);
  });

  it('stops the sites of the repository showing as checking', async () => {
    const { db, raw } = made();
    await addDomain(db, 1, 'a.test', 'o/a');
    await addDomain(db, 1, 'b.test', 'o/b');
    await markChecking(db, 1, 'a.test', '2026-01-01T00:00:00.000Z');
    await markChecking(db, 1, 'b.test', '2026-01-01T00:00:00.000Z');
    await stopChecking(db, 'o/a');
    const rows = raw
      .prepare('select host, checking_since from domains order by host')
      .all();
    expect(rows).toEqual([
      { host: 'a.test', checking_since: null },
      { host: 'b.test', checking_since: '2026-01-01T00:00:00.000Z' },
    ]);
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
