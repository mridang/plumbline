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
      fork?: boolean;
    }
  >,
): GitHubApi {
  const fetcher = (async (input: unknown) => {
    const url = new URL(String(input));
    if (url.pathname === '/installation/repositories') {
      const size = Number(url.searchParams.get('per_page') ?? 100);
      const page = Number(url.searchParams.get('page') ?? 1);
      return Response.json({
        repositories: Object.entries(repos)
          .slice((page - 1) * size, page * size)
          .map(([full_name, r]) => ({
            full_name,
            default_branch: 'main',
            homepage: r.homepage,
            archived: r.archived,
            fork: r.fork,
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
      fallback: ['site.example.com'],
      declared: [],
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
    // Domains created in the same millisecond have no fixed order.
    expect(
      (await listDomains(db, 7))
        .map((d) => [d.host, d.repo])
        .toSorted(([a], [b]) => String(a).localeCompare(String(b))),
    ).toEqual([
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

  it('reads an account with well over a hundred repositories, the last one included', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    const many: Record<string, { files: Record<string, string> }> = {};
    for (let i = 0; i < 140; i += 1) {
      many[`o/r${i}`] = { files: {} };
    }
    many['o/zlast'] = {
      files: { 'wrangler.jsonc': '{"route": "last.example.com/*"}' },
    };
    expect(await syncInstallation(db, 7, 99, githubWith(many))).toMatchObject({
      repositories: 141,
      deployed: 1,
    });
    expect((await listDomains(db, 7)).map((d) => d.host)).toEqual([
      'last.example.com',
    ]);
  });

  it("ignores a fork's website, which is the upstream project's", async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    const api = githubWith({
      'o/fork': { files: {}, homepage: 'https://upstream.dev', fork: true },
      'o/own': { files: {}, homepage: 'https://own.example.com' },
    });
    expect(await syncInstallation(db, 7, 99, api)).toMatchObject({
      deployed: 1,
    });
    expect((await listDomains(db, 7)).map((d) => d.host)).toEqual([
      'own.example.com',
    ]);
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

  it('removes the sites of a repository that was deleted, and keeps the others', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    const site = (host: string) => ({
      files: { 'wrangler.jsonc': `{"route": "${host}/*"}` },
    });
    await syncInstallation(
      db,
      7,
      99,
      githubWith({
        'o/keep': site('keep.example.com'),
        'o/gone': site('gone.example.com'),
        'o/old': { ...site('old.example.com') },
      }),
    );
    await addDomain(db, 7, 'hand.example.com');
    await syncInstallation(
      db,
      7,
      99,
      githubWith({
        'o/keep': site('keep.example.com'),
        'o/old': { ...site('old.example.com'), archived: true },
      }),
    );
    expect((await listDomains(db, 7)).map((d) => d.host).toSorted()).toEqual([
      'hand.example.com',
      'keep.example.com',
      'old.example.com',
    ]);
  });

  it('removes the sites of a repository that left a former sync but is gone from the list too', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    await addDomain(db, 7, 'orphan.example.com', 'o/deleted');
    await syncInstallation(db, 7, 99, githubWith({ 'o/a': { files: {} } }));
    expect(await listDomains(db, 7)).toEqual([]);
  });

  it('keeps the sites of repositories of the same person in another installation', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    await syncInstallation(
      db,
      7,
      98,
      githubWith({
        'p/other': {
          files: { 'wrangler.jsonc': '{"route": "other.example.com/*"}' },
        },
      }),
    );
    await syncInstallation(db, 7, 99, githubWith({ 'o/a': { files: {} } }));
    expect((await listDomains(db, 7)).map((d) => d.host)).toEqual([
      'other.example.com',
    ]);
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

describe('syncInstallation, where the sites come from', () => {
  const route = (host: string) => ({
    'wrangler.jsonc': `{"route": "${host}/*"}`,
  });
  const hostsOf = async (db: ReturnType<typeof sqliteDatabase>['db']) =>
    (await listDomains(db, 7)).map((d) => [d.host, d.source]).toSorted();

  it('takes the sites a plumbline.yaml declares, and not the routes or the Website field', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    await syncInstallation(
      db,
      7,
      99,
      githubWith({
        'o/site': {
          files: {
            ...route('route.example.com'),
            'plumbline.yaml': 'sites:\n  - https://api.example.com\n',
          },
          homepage: 'https://www.example.com',
        },
      }),
    );
    expect(await hostsOf(db)).toEqual([['api.example.com', 'config']]);
  });

  it('does not consult the Website field once a Wrangler route is found: a stale field cannot add a dead site', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    await syncInstallation(
      db,
      7,
      99,
      githubWith({
        'o/marshall': {
          files: route('marshall.apps.mrida.ng'),
          homepage: 'https://marshall.agarwal.la/',
        },
      }),
    );
    expect(await hostsOf(db)).toEqual([['marshall.apps.mrida.ng', 'fallback']]);
  });

  it('drops a dead site a Website field once added, as soon as a better source names one', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    await addDomain(db, 7, 'marshall.agarwal.la', 'o/marshall', {
      source: 'fallback',
    });
    await syncInstallation(
      db,
      7,
      99,
      githubWith({
        'o/marshall': {
          files: route('marshall.apps.mrida.ng'),
          homepage: 'https://marshall.agarwal.la/',
        },
      }),
    );
    expect(await hostsOf(db)).toEqual([['marshall.apps.mrida.ng', 'fallback']]);
  });

  it('drops a declared site when the file stops declaring it', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    await syncInstallation(
      db,
      7,
      99,
      githubWith({
        'o/site': {
          files: { 'plumbline.yaml': 'sites: [a.example.com, b.example.com]' },
        },
      }),
    );
    await syncInstallation(
      db,
      7,
      99,
      githubWith({
        'o/site': { files: { 'plumbline.yaml': 'sites: [a.example.com]' } },
      }),
    );
    expect(await hostsOf(db)).toEqual([['a.example.com', 'config']]);
  });

  it('keeps the site a deployment named, and drops the fallback the routes suggest', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    await addDomain(db, 7, 'live.example.com', 'o/site', {
      source: 'deployment',
      environment: 'production',
    });
    await addDomain(db, 7, 'route.example.com', 'o/site', {
      source: 'fallback',
    });
    await syncInstallation(
      db,
      7,
      99,
      githubWith({ 'o/site': { files: route('route.example.com') } }),
    );
    expect(await hostsOf(db)).toEqual([['live.example.com', 'deployment']]);
    expect((await listRepos(db, 7))[0]?.hosts).toEqual(['live.example.com']);
  });

  it('keeps the sites of a repository that could not be read this time, so a GitHub hiccup drops nothing', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    await addDomain(db, 7, 'site.example.com', 'o/site', {
      source: 'fallback',
    });
    await syncInstallation(
      db,
      7,
      99,
      githubWith({ 'o/site': { files: {}, broken: true } }),
    );
    expect(await hostsOf(db)).toEqual([['site.example.com', 'fallback']]);
  });

  it("does not take the sites of a fork's file, which is the upstream project's", async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    await syncInstallation(
      db,
      7,
      99,
      githubWith({
        'o/fork': {
          files: { 'plumbline.yaml': 'sites: [upstream.example.com]' },
          fork: true,
        },
      }),
    );
    expect(await hostsOf(db)).toEqual([]);
  });

  it('never drops a site the person added, whatever the repository says', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    await addDomain(db, 7, 'hand.example.com', 'o/site');
    await syncInstallation(
      db,
      7,
      99,
      githubWith({ 'o/site': { files: route('route.example.com') } }),
    );
    expect(await hostsOf(db)).toEqual([
      ['hand.example.com', 'manual'],
      ['route.example.com', 'fallback'],
    ]);
  });
});
