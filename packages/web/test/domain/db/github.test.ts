import { describe, expect, it } from '@jest/globals';

import {
  getLink,
  linkAccount,
  listInstallations,
  listRepos,
  ownerOfInstallation,
  removeInstallation,
  reposNamed,
  saveInstallation,
  saveRepos,
  unlinkAccount,
} from '@/domain/db/github';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

const empty = () => sqliteDatabase(...APP_MIGRATIONS).db;

describe('linkAccount', () => {
  it('connects a GitHub account to a person and renames it when the login changes', async () => {
    const db = empty();
    expect(await linkAccount(db, 1, { id: 10, login: 'old' })).toBe(true);
    expect(await linkAccount(db, 1, { id: 10, login: 'new' })).toBe(true);
    expect(await getLink(db, 1)).toMatchObject({ github_id: 10, login: 'new' });
  });

  it('refuses an account that belongs to someone else', async () => {
    const db = empty();
    await linkAccount(db, 1, { id: 10, login: 'a' });
    expect(await linkAccount(db, 2, { id: 10, login: 'a' })).toBe(false);
    expect(await getLink(db, 2)).toBeUndefined();
  });

  it('lets a person move to another GitHub account', async () => {
    const db = empty();
    await linkAccount(db, 1, { id: 10, login: 'a' });
    expect(await linkAccount(db, 1, { id: 11, login: 'b' })).toBe(true);
    const link = await getLink(db, 1);
    expect(link?.github_id).toBe(11);
  });
});

describe('installations', () => {
  it("records an installation as the person's and lists theirs", async () => {
    const db = empty();
    expect(await saveInstallation(db, 1, 100, 'acme')).toBe(true);
    expect(await saveInstallation(db, 1, 100, 'acme-renamed')).toBe(true);
    await saveInstallation(db, 2, 200, 'other');
    const installations = await listInstallations(db, 1);
    expect(installations.map((i) => i.account_login)).toEqual(['acme-renamed']);
    expect(await ownerOfInstallation(db, 100)).toBe(1);
    expect(await ownerOfInstallation(db, 999)).toBeUndefined();
  });

  it('does not hand an installation to someone else', async () => {
    const db = empty();
    await saveInstallation(db, 1, 100, 'acme');
    expect(await saveInstallation(db, 2, 100, 'acme')).toBe(false);
    expect(await ownerOfInstallation(db, 100)).toBe(1);
  });

  it('forgets an installation with its repositories', async () => {
    const db = empty();
    await saveInstallation(db, 1, 100, 'acme');
    await saveRepos(db, 1, 100, [
      { full_name: 'a/b', default_branch: 'main', hosts: [] },
    ]);
    await removeInstallation(db, 100);
    expect(await listInstallations(db, 1)).toEqual([]);
    expect(await listRepos(db, 1)).toEqual([]);
  });
});

describe('repositories', () => {
  const repo = (name: string, hosts: string[] = []) => ({
    full_name: name,
    default_branch: 'main',
    hosts,
  });

  it('stores them with their hosts, by name, and updates them in place', async () => {
    const db = empty();
    await saveRepos(db, 1, 100, [repo('a/z', ['z.example.com']), repo('a/b')]);
    await saveRepos(db, 1, 100, [repo('a/z', ['z2.example.com']), repo('a/b')]);
    const repos = await listRepos(db, 1);
    expect(repos.map((r) => [r.full_name, r.hosts])).toEqual([
      ['a/b', []],
      ['a/z', ['z2.example.com']],
    ]);
  });

  it('forgets those no longer given, and all of them for an empty list', async () => {
    const db = empty();
    await saveRepos(db, 1, 100, [repo('a/b'), repo('a/c')]);
    await saveRepos(db, 1, 100, [repo('a/b')]);
    const repos = await listRepos(db, 1);
    expect(repos.map((r) => r.full_name)).toEqual(['a/b']);
    await saveRepos(db, 1, 100, []);
    expect(await listRepos(db, 1)).toEqual([]);
  });

  it('stays inside the 100 values D1 binds per query, however many repositories there are', async () => {
    const made = sqliteDatabase(...APP_MIGRATIONS);
    const prepare = made.raw.prepare.bind(made.raw);
    made.raw.prepare = (sql: string) => {
      if ((sql.match(/\?/g) ?? []).length > 100) {
        throw new Error('too many SQL variables');
      }
      return prepare(sql);
    };
    const names = Array.from({ length: 180 }, (_, i) => `a/r${i}`);
    await saveRepos(
      made.db,
      1,
      100,
      names.map((n) => repo(n)),
    );
    await saveRepos(
      made.db,
      1,
      100,
      names.slice(0, 100).map((n) => repo(n)),
    );
    expect(await listRepos(made.db, 1)).toHaveLength(100);
  });

  it("keeps one person's repositories from another", async () => {
    const db = empty();
    await saveRepos(db, 1, 100, [repo('a/b')]);
    await saveRepos(db, 2, 200, [repo('c/d')]);
    const repos = await listRepos(db, 1);
    expect(repos.map((r) => r.full_name)).toEqual(['a/b']);
  });

  it('reads hosts that are not a list of strings as none', async () => {
    const { db, raw } = sqliteDatabase(...APP_MIGRATIONS);
    for (const [name, hosts] of [
      ['a/1', 'nope'],
      ['a/2', '{"a":1}'],
      ['a/3', '[1]'],
    ]) {
      raw
        .prepare(
          "INSERT INTO github_repos VALUES (100, ?, 1, 'main', ?, 'now')",
        )
        .run(name!, hosts!);
    }
    const repos = await listRepos(db, 1);
    expect(repos.map((r) => r.hosts)).toEqual([[], [], []]);
  });

  it('says which of some names the person has', async () => {
    const db = empty();
    await saveRepos(db, 1, 100, [repo('a/b'), repo('a/c')]);
    expect(await reposNamed(db, 1, ['a/b', 'x/y'])).toEqual(['a/b']);
    expect(await reposNamed(db, 1, [])).toEqual([]);
    expect(await reposNamed(db, 2, ['a/b'])).toEqual([]);
  });
});

describe('unlinkAccount', () => {
  it('forgets the link, the installations and the repositories of the person only', async () => {
    const db = empty();
    await linkAccount(db, 1, { id: 10, login: 'a' });
    await saveInstallation(db, 1, 100, 'acme');
    await saveRepos(db, 1, 100, [
      { full_name: 'a/b', default_branch: 'main', hosts: [] },
    ]);
    await linkAccount(db, 2, { id: 20, login: 'b' });
    await unlinkAccount(db, 1);
    expect(await getLink(db, 1)).toBeUndefined();
    expect(await listInstallations(db, 1)).toEqual([]);
    expect(await listRepos(db, 1)).toEqual([]);
    expect(await getLink(db, 2)).toBeDefined();
  });
});
