import { describe, expect, it } from '@jest/globals';

import { MAX_DOMAINS, addDomain, listDomains } from '@/domain/db/domains';
import { listRepos } from '@/domain/db/github';
import { GitHubApi } from '@/domain/github/api';
import { analyseRepo, syncInstallation } from '@/domain/github/sync';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

/** A fake GitHub with these repositories: name → files (path → text) and website. */
function githubWith(
  repos: Record<
    string,
    {
      files: Record<string, string>;
      homepage?: string;
      archived?: boolean;
      broken?: boolean;
    }
  >,
): GitHubApi {
  const fetcher = (async (input: unknown) => {
    const url = new URL(String(input));
    if (url.pathname === '/installation/repositories') {
      return Response.json({
        repositories: Object.entries(repos).map(([full_name, r]) => ({
          full_name,
          default_branch: 'main',
          homepage: r.homepage,
          archived: r.archived,
        })),
      });
    }
    const [, , owner, name, kind, ...rest] = url.pathname.split('/');
    const repo = repos[`${owner}/${name}`];
    if (!repo || repo.broken) {
      return new Response('no', { status: 404 });
    }
    if (kind === 'git') {
      return Response.json({
        tree: Object.keys(repo.files).map((path) => ({ path, type: 'blob' })),
      });
    }
    return new Response(repo.files[decodeURIComponent(rest.join('/'))] ?? '');
  }) as typeof fetch;
  return new GitHubApi('t', fetcher);
}

describe('analyseRepo', () => {
  it('finds the hosts of a deployed application', async () => {
    const api = githubWith({
      'o/site': {
        files: { 'wrangler.jsonc': '{"route": "site.example.com/*"}' },
      },
    });
    expect(
      await analyseRepo(api, { full_name: 'o/site', default_branch: 'main' }),
    ).toEqual({
      full_name: 'o/site',
      default_branch: 'main',
      hosts: ['site.example.com'],
    });
  });

  it('finds nothing in a repository that cannot be read', async () => {
    const api = githubWith({ 'o/gone': { files: {}, broken: true } });
    expect(
      (await analyseRepo(api, { full_name: 'o/gone', default_branch: 'main' }))
        .hosts,
    ).toEqual([]);
  });
});

describe('syncInstallation', () => {
  it('stores the repositories and adds the deployed hosts as domains of the owner', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    const api = githubWith({
      'o/site': {
        files: { 'wrangler.jsonc': '{"route": "site.example.com/*"}' },
      },
      'o/lib': { files: { 'package.json': '{}' } },
      'o/old': {
        files: { 'wrangler.jsonc': '{"route": "old.example.com/*"}' },
        archived: true,
      },
      'o/site2': { files: {}, homepage: 'https://two.example.com' },
    });
    const result = await syncInstallation(db, 7, 99, api);
    expect(result).toEqual({ repositories: 3, deployed: 2, domainsAdded: 2 });
    expect((await listRepos(db, 7)).map((r) => [r.full_name, r.hosts])).toEqual(
      [
        ['o/lib', []],
        ['o/site', ['site.example.com']],
        ['o/site2', ['two.example.com']],
      ],
    );
    expect((await listDomains(db, 7)).map((d) => [d.host, d.repo])).toEqual([
      ['site.example.com', 'o/site'],
      ['two.example.com', 'o/site2'],
    ]);
  });

  it('does not add a host twice, and tags one the person added by hand', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    await addDomain(db, 7, 'site.example.com');
    const api = githubWith({
      'o/site': {
        files: { 'wrangler.jsonc': '{"route": "site.example.com/*"}' },
      },
    });
    expect(await syncInstallation(db, 7, 99, api)).toMatchObject({
      domainsAdded: 0,
    });
    expect(await syncInstallation(db, 7, 99, api)).toMatchObject({
      domainsAdded: 0,
    });
    expect((await listDomains(db, 7)).map((d) => d.repo)).toEqual(['o/site']);
  });

  it('stops adding domains at the limit', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    for (let i = 0; i < MAX_DOMAINS - 1; i += 1) {
      await addDomain(db, 7, `d${i}.example.com`);
    }
    const api = githubWith({
      'o/a': { files: {}, homepage: 'https://a.example.com' },
      'o/b': { files: {}, homepage: 'https://b.example.com' },
    });
    expect(await syncInstallation(db, 7, 99, api)).toMatchObject({
      deployed: 2,
      domainsAdded: 1,
    });
    expect(await listDomains(db, 7)).toHaveLength(MAX_DOMAINS);
  });

  it('forgets repositories that left the installation', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    await syncInstallation(
      db,
      7,
      99,
      githubWith({ 'o/a': { files: {} }, 'o/b': { files: {} } }),
    );
    await syncInstallation(db, 7, 99, githubWith({ 'o/a': { files: {} } }));
    expect((await listRepos(db, 7)).map((r) => r.full_name)).toEqual(['o/a']);
  });
});
