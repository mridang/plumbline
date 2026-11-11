import { describe, expect, it } from '@jest/globals';

import { ACCESS_TTL_MS, replaceAccess } from '@/domain/db/access';
import {
  canManageRepo,
  canSeeRepo,
  disableRepo,
  disableRepoByFile,
  disabledRepos,
  enableRepo,
  enableRepoByFile,
  fileDisabledRepos,
  isRepoDisabled,
  isRepoFileDisabled,
  isRepoSwitchedOff,
  manageableRepos,
  stopChecking,
} from '@/domain/db/disabled';
import { addDomain } from '@/domain/db/domains';
import { saveInstallation, saveRepos } from '@/domain/db/github';
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
    expect(
      [...(await disabledRepos(db, 1))].toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    ).toEqual(['o/mine', 'o/shared']);
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

/** A repository as the analysis of an installation stores it. */
const analysed = (fullName: string) => ({
  full_name: fullName,
  default_branch: 'main',
  hosts: [],
});

describe('canManageRepo', () => {
  it('is true for the person who installed the app for the repository, and only for them', async () => {
    const db = empty();
    await saveInstallation(db, 1, 10, 'acme');
    await saveRepos(db, 1, 10, [analysed('acme/site')]);
    expect(await canManageRepo(db, 1, 'acme/site')).toBe(true);
    expect(await canManageRepo(db, 2, 'acme/site')).toBe(false);
  });

  it('is false for a person who only sees the repository, through a site or through access', async () => {
    const db = empty();
    await saveInstallation(db, 1, 10, 'acme');
    await saveRepos(db, 1, 10, [analysed('acme/site')]);
    await addDomain(db, 2, 'a.test', 'acme/site');
    await replaceAccess(db, 3, ['acme/site']);
    expect(await canSeeRepo(db, 2, 'acme/site')).toBe(true);
    expect(await canManageRepo(db, 2, 'acme/site')).toBe(false);
    expect(await canManageRepo(db, 3, 'acme/site')).toBe(false);
  });

  it('is false for a repository no installation covers', async () => {
    const db = empty();
    await addDomain(db, 1, 'a.test', 'acme/site');
    expect(await canManageRepo(db, 1, 'acme/site')).toBe(false);
    expect(await canManageRepo(db, 1, 'acme/unknown')).toBe(false);
  });

  it('is false when the installation is unknown, whatever its repositories say', async () => {
    const db = empty();
    await saveRepos(db, 1, 10, [analysed('acme/orphan')]);
    expect(await canManageRepo(db, 1, 'acme/orphan')).toBe(false);
  });

  it('follows the installation, not the user the repository row was stored for', async () => {
    const db = empty();
    await saveInstallation(db, 1, 10, 'acme');
    await saveRepos(db, 2, 10, [analysed('acme/site')]);
    expect(await canManageRepo(db, 1, 'acme/site')).toBe(true);
    expect(await canManageRepo(db, 2, 'acme/site')).toBe(false);
  });
});

describe('manageableRepos', () => {
  it('lists the repositories of the installations the person owns', async () => {
    const db = empty();
    await saveInstallation(db, 1, 10, 'acme');
    await saveInstallation(db, 2, 20, 'other');
    await saveRepos(db, 1, 10, [analysed('acme/a'), analysed('acme/b')]);
    await saveRepos(db, 2, 20, [analysed('other/c')]);
    expect(
      [...(await manageableRepos(db, 1))].toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    ).toEqual(['acme/a', 'acme/b']);
    expect([...(await manageableRepos(db, 3))]).toEqual([]);
  });
});

describe('turning checks off in plumbline.yaml', () => {
  it('is its own flag: off by file is off, but not off by the switch', async () => {
    const db = empty();
    expect(await disableRepoByFile(db, 'o/a')).toBe(true);
    expect(await isRepoFileDisabled(db, 'o/a')).toBe(true);
    expect(await isRepoSwitchedOff(db, 'o/a')).toBe(false);
    expect(await isRepoDisabled(db, 'o/a')).toBe(true);
    expect(await isRepoDisabled(db, 'o/b')).toBe(false);
  });

  it('says whether it changed anything', async () => {
    const db = empty();
    expect(await disableRepoByFile(db, 'o/a')).toBe(true);
    expect(await disableRepoByFile(db, 'o/a')).toBe(false);
    expect(await enableRepoByFile(db, 'o/a')).toBe(true);
    expect(await enableRepoByFile(db, 'o/a')).toBe(false);
  });

  it('keeps the switch: the repository is off while either is', async () => {
    const db = empty();
    await disableRepo(db, 1, 'o/a');
    await disableRepoByFile(db, 'o/a');
    await enableRepoByFile(db, 'o/a');
    expect(await isRepoDisabled(db, 'o/a')).toBe(true);
    await enableRepo(db, 'o/a');
    expect(await isRepoDisabled(db, 'o/a')).toBe(false);
  });

  it('lists, for a person, the repositories off by file that they can see, and counts them as off', async () => {
    const db = empty();
    await addDomain(db, 1, 'a.test', 'o/mine');
    await addDomain(db, 2, 'b.test', 'o/shared');
    await addDomain(db, 2, 'c.test', 'o/private');
    await replaceAccess(db, 1, ['o/shared']);
    for (const repo of ['o/mine', 'o/shared', 'o/private']) {
      await disableRepoByFile(db, repo);
    }
    expect(
      [...(await fileDisabledRepos(db, 1))].toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    ).toEqual(['o/mine', 'o/shared']);
    expect(
      [...(await disabledRepos(db, 1))].toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    ).toEqual(['o/mine', 'o/shared']);
  });
});
