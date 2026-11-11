import { describe, expect, it } from '@jest/globals';

import {
  MAX_DOMAINS,
  addDomain,
  listDomains,
  type SiteSource,
} from '@/domain/db/domains';
import { reconcileSites } from '@/domain/github/sites';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

const empty = () => sqliteDatabase(...APP_MIGRATIONS);

type Db = ReturnType<typeof empty>['db'];

/** The sites of a person as host, repository, source and environment, in host order. */
async function sitesOf(db: Db, user = 1) {
  const domains = await listDomains(db, user);
  return domains
    .map((d) => [d.host, d.repo, d.source, d.environment] as const)
    .toSorted(([a], [b]) => a.localeCompare(b));
}

/** The hosts of a person's sites, in host order. */
async function hostsOf(db: Db, user = 1) {
  const sites = await sitesOf(db, user);
  return sites.map(([host]) => host);
}

const seed = (
  db: Db,
  host: string,
  source: SiteSource,
  repo: string | null = 'o/site',
  environment: string | null = null,
) => addDomain(db, 1, host, repo, { source, environment });

describe('reconcileSites, the sites a file declares', () => {
  it('adds them as config sites of the repository', async () => {
    const { db } = empty();
    const changes = await reconcileSites(db, 1, 'o/site', {
      declared: ['a.example.com', 'b.example.com'],
    });
    expect(changes).toEqual({
      added: ['a.example.com', 'b.example.com'],
      removed: [],
    });
    expect(await sitesOf(db)).toEqual([
      ['a.example.com', 'o/site', 'config', null],
      ['b.example.com', 'o/site', 'config', null],
    ]);
  });

  it('drops a config site the file no longer declares, and says which', async () => {
    const { db } = empty();
    await seed(db, 'a.example.com', 'config');
    await seed(db, 'b.example.com', 'config');
    const changes = await reconcileSites(db, 1, 'o/site', {
      declared: ['a.example.com'],
    });
    expect(changes.removed).toEqual(['b.example.com']);
    expect(await hostsOf(db)).toEqual(['a.example.com']);
  });

  it('leaves the config sites alone when the file could not be read', async () => {
    const { db } = empty();
    await seed(db, 'a.example.com', 'config');
    await reconcileSites(db, 1, 'o/site', { declared: null });
    await reconcileSites(db, 1, 'o/site', {});
    expect(await hostsOf(db)).toEqual(['a.example.com']);
  });

  it('never drops a site a person added, not even one the file used to declare', async () => {
    const { db } = empty();
    await seed(db, 'hand.example.com', 'manual', null);
    await reconcileSites(db, 1, 'o/site', { declared: ['hand.example.com'] });
    await reconcileSites(db, 1, 'o/site', { declared: [] });
    expect(await sitesOf(db)).toEqual([
      ['hand.example.com', 'o/site', 'manual', null],
    ]);
  });
});

describe('reconcileSites, the address a deployment reports', () => {
  it('adds it as a deployment site of that environment', async () => {
    const { db } = empty();
    await reconcileSites(db, 1, 'o/site', {
      deployed: { environment: 'prd_foo', host: 'foo.example.com' },
    });
    expect(await sitesOf(db)).toEqual([
      ['foo.example.com', 'o/site', 'deployment', 'prd_foo'],
    ]);
  });

  it('keeps one site for each environment, so a repository of microservices has them all', async () => {
    const { db } = empty();
    await reconcileSites(db, 1, 'o/site', {
      deployed: { environment: 'prd_foo', host: 'foo.example.com' },
    });
    await reconcileSites(db, 1, 'o/site', {
      deployed: { environment: 'micro_svc', host: 'svc.example.com' },
    });
    expect(await hostsOf(db)).toEqual(['foo.example.com', 'svc.example.com']);
  });

  it('replaces the address of an environment that now reports another', async () => {
    const { db } = empty();
    await reconcileSites(db, 1, 'o/site', {
      deployed: { environment: 'production', host: 'old.example.com' },
    });
    await reconcileSites(db, 1, 'o/site', {
      deployed: { environment: 'prd_foo', host: 'foo.example.com' },
    });
    const changes = await reconcileSites(db, 1, 'o/site', {
      deployed: { environment: 'production', host: 'new.example.com' },
    });
    expect(changes).toEqual({
      added: ['new.example.com'],
      removed: ['old.example.com'],
    });
    expect(await hostsOf(db)).toEqual(['foo.example.com', 'new.example.com']);
  });

  it('does not drop the old address of an environment when the file declares it', async () => {
    const { db } = empty();
    await reconcileSites(db, 1, 'o/site', {
      deployed: { environment: 'production', host: 'old.example.com' },
    });
    await reconcileSites(db, 1, 'o/site', {
      declared: ['old.example.com'],
      deployed: { environment: 'production', host: 'new.example.com' },
    });
    expect(await hostsOf(db)).toEqual(['new.example.com', 'old.example.com']);
  });

  it('does not drop a site a person added when the environment moves on', async () => {
    const { db } = empty();
    await seed(db, 'hand.example.com', 'manual', 'o/site');
    await reconcileSites(db, 1, 'o/site', {
      deployed: { environment: 'production', host: 'hand.example.com' },
    });
    await reconcileSites(db, 1, 'o/site', {
      deployed: { environment: 'production', host: 'new.example.com' },
    });
    expect(await hostsOf(db)).toEqual(['hand.example.com', 'new.example.com']);
  });
});

describe('reconcileSites, the fallback', () => {
  it('adds the Wrangler routes and the Website field while nothing better is known', async () => {
    const { db } = empty();
    await reconcileSites(db, 1, 'o/site', {
      declared: [],
      fallback: ['a.example.com'],
    });
    expect(await sitesOf(db)).toEqual([
      ['a.example.com', 'o/site', 'fallback', null],
    ]);
  });

  it('drops a fallback site the routes no longer suggest', async () => {
    const { db } = empty();
    await seed(db, 'marshall.agarwal.la', 'fallback');
    await reconcileSites(db, 1, 'o/site', {
      declared: [],
      fallback: ['marshall.apps.mrida.ng'],
    });
    expect(await hostsOf(db)).toEqual(['marshall.apps.mrida.ng']);
  });

  it('is dropped, and not added, once a deployment has named a site', async () => {
    const { db } = empty();
    await seed(db, 'stale.example.com', 'fallback');
    await reconcileSites(db, 1, 'o/site', {
      deployed: { environment: 'production', host: 'live.example.com' },
    });
    expect(await hostsOf(db)).toEqual(['live.example.com']);
    await reconcileSites(db, 1, 'o/site', {
      declared: [],
      fallback: ['stale.example.com'],
    });
    expect(await hostsOf(db)).toEqual(['live.example.com']);
  });

  it('is dropped, and not added, once the file declares a site', async () => {
    const { db } = empty();
    await seed(db, 'stale.example.com', 'fallback');
    await reconcileSites(db, 1, 'o/site', {
      declared: ['declared.example.com'],
      fallback: ['stale.example.com'],
    });
    expect(await hostsOf(db)).toEqual(['declared.example.com']);
  });

  it('is left alone when the repository could not be read', async () => {
    const { db } = empty();
    await seed(db, 'a.example.com', 'fallback');
    await reconcileSites(db, 1, 'o/site', { declared: null, fallback: null });
    expect(await hostsOf(db)).toEqual(['a.example.com']);
  });

  it('becomes the deployment site when a deployment reports the same address', async () => {
    const { db } = empty();
    await seed(db, 'a.example.com', 'fallback');
    await reconcileSites(db, 1, 'o/site', {
      deployed: { environment: 'production', host: 'a.example.com' },
    });
    expect(await sitesOf(db)).toEqual([
      ['a.example.com', 'o/site', 'deployment', 'production'],
    ]);
  });
});

describe('reconcileSites, whose sites it touches', () => {
  it('leaves the sites of other repositories and other people alone', async () => {
    const { db } = empty();
    await seed(db, 'other.example.com', 'config', 'o/other');
    await addDomain(db, 2, 'theirs.example.com', 'o/site', {
      source: 'config',
    });
    await reconcileSites(db, 1, 'o/site', { declared: [], fallback: [] });
    expect(await hostsOf(db)).toEqual(['other.example.com']);
    expect(await hostsOf(db, 2)).toEqual(['theirs.example.com']);
  });

  it('stops adding at the number of domains a person may keep', async () => {
    const { db } = empty();
    for (let i = 0; i < MAX_DOMAINS - 1; i += 1) {
      await addDomain(db, 1, `d${i}.example.com`);
    }
    const changes = await reconcileSites(db, 1, 'o/site', {
      declared: ['a.example.com', 'b.example.com'],
    });
    expect(changes.added).toEqual(['a.example.com']);
    expect(await listDomains(db, 1)).toHaveLength(MAX_DOMAINS);
  });

  it('still tags a site the person has when the limit is reached', async () => {
    const { db } = empty();
    for (let i = 0; i < MAX_DOMAINS - 1; i += 1) {
      await addDomain(db, 1, `d${i}.example.com`);
    }
    await addDomain(db, 1, 'full.example.com');
    await reconcileSites(db, 1, 'o/site', { declared: ['full.example.com'] });
    const domains = await listDomains(db, 1);
    expect(domains.find((d) => d.host === 'full.example.com')).toMatchObject({
      repo: 'o/site',
      source: 'manual',
    });
  });
});
