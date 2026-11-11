import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  addDomain,
  countDomains,
  deleteDomain,
  deleteSites,
  domainOf,
  findDomainByHost,
  getDomain,
  listDomains,
  removeSitesOfMissingRepos,
  setDomainChecks,
} from '@/domain/db/domains';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

/** A database with every migration applied and nothing in it. */
const empty = () => sqliteDatabase(...APP_MIGRATIONS);

afterEach(() => {
  jest.useRealTimers();
});

/** Make the clock read `iso`, so rows get the times a test needs. */
const at = (iso: string) => {
  jest.useFakeTimers({ now: new Date(iso), doNotFake: ['queueMicrotask'] });
};

/** A stored row, as the table holds it. */
const row = (checks: string | null) => ({
  id: 'd1',
  user_id: 1,
  host: 'example.com',
  checks,
  repo: null,
  source: 'manual',
  environment: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});

describe('domainOf', () => {
  it('reads the chosen checks out of the JSON column', () => {
    expect(domainOf(row('["hsts","csp"]')).checks).toEqual(['hsts', 'csp']);
  });

  it('does not show when the site was last checked', () => {
    expect(
      domainOf({ ...row(null), checked_at: '2026-01-01' } as ReturnType<
        typeof row
      >),
    ).not.toHaveProperty('checked_at');
  });

  it('reads no choice as every check', () => {
    expect(domainOf(row(null)).checks).toBeNull();
  });

  it('reads text that is not JSON as every check', () => {
    expect(domainOf(row('not json')).checks).toBeNull();
  });

  it('reads JSON that is not a list of strings as every check', () => {
    expect(domainOf(row('[1, 2]')).checks).toBeNull();
  });

  it('reads a JSON object as every check', () => {
    expect(domainOf(row('{"a":1}')).checks).toBeNull();
  });
});

describe('addDomain', () => {
  it('adds a domain that runs every check', async () => {
    const { db } = empty();
    const { domain, created } = await addDomain(db, 1, 'example.com');
    expect(created).toBe(true);
    expect(domain).toMatchObject({
      user_id: 1,
      host: 'example.com',
      checks: null,
    });
  });

  it('gives the domain a UUID', async () => {
    const { db } = empty();
    const { domain } = await addDomain(db, 1, 'example.com');
    expect(domain.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('answers the domain the person already has for that host', async () => {
    const { db } = empty();
    const first = await addDomain(db, 1, 'example.com');
    const again = await addDomain(db, 1, 'example.com');
    expect(again).toEqual({ domain: first.domain, created: false });
  });

  it('lets two people keep the same host', async () => {
    const { db } = empty();
    await addDomain(db, 1, 'example.com');
    const other = await addDomain(db, 2, 'example.com');
    expect(other.created).toBe(true);
  });
});

describe('listDomains and countDomains', () => {
  it('lists only the person’s domains, oldest first', async () => {
    const { db } = empty();
    at('2026-01-02T00:00:00.000Z');
    await addDomain(db, 1, 'b.example');
    await addDomain(db, 2, 'other.example');
    at('2026-01-01T00:00:00.000Z');
    await addDomain(db, 1, 'a.example');
    const listed = await listDomains(db, 1);
    expect(listed.map((d) => d.host)).toEqual(['a.example', 'b.example']);
  });

  it('counts only the person’s domains', async () => {
    const { db } = empty();
    await addDomain(db, 1, 'a.example');
    await addDomain(db, 1, 'b.example');
    await addDomain(db, 2, 'c.example');
    expect(await countDomains(db, 1)).toBe(2);
  });

  it('counts nothing for someone with no domains', async () => {
    const { db } = empty();
    expect(await countDomains(db, 1)).toBe(0);
  });
});

describe('getDomain and findDomainByHost', () => {
  it('finds the person’s domain by id', async () => {
    const { db } = empty();
    const { domain } = await addDomain(db, 1, 'example.com');
    expect(await getDomain(db, 1, domain.id)).toEqual(domain);
  });

  it('never finds another person’s domain by id', async () => {
    const { db } = empty();
    const { domain } = await addDomain(db, 1, 'example.com');
    expect(await getDomain(db, 2, domain.id)).toBeUndefined();
  });

  it('finds the person’s domain by host', async () => {
    const { db } = empty();
    const { domain } = await addDomain(db, 1, 'example.com');
    expect(await findDomainByHost(db, 1, 'example.com')).toEqual(domain);
  });

  it('never finds another person’s domain by host', async () => {
    const { db } = empty();
    await addDomain(db, 1, 'example.com');
    expect(await findDomainByHost(db, 2, 'example.com')).toBeUndefined();
  });
});

describe('setDomainChecks', () => {
  it('stores the chosen checks', async () => {
    const { db } = empty();
    const { domain } = await addDomain(db, 1, 'example.com');
    await setDomainChecks(db, 1, domain.id, ['hsts']);
    const stored = await getDomain(db, 1, domain.id);
    expect(stored?.checks).toEqual(['hsts']);
  });

  it('goes back to every check for null', async () => {
    const { db } = empty();
    const { domain } = await addDomain(db, 1, 'example.com');
    await setDomainChecks(db, 1, domain.id, ['hsts']);
    const reset = await setDomainChecks(db, 1, domain.id, null);
    expect(reset?.checks).toBeNull();
  });

  it('changes nothing of another person’s domain', async () => {
    const { db } = empty();
    const { domain } = await addDomain(db, 1, 'example.com');
    expect(await setDomainChecks(db, 2, domain.id, ['hsts'])).toBeUndefined();
    const after = await getDomain(db, 1, domain.id);
    expect(after?.checks).toBeNull();
  });
});

describe('deleteDomain', () => {
  it('removes the person’s domain', async () => {
    const { db } = empty();
    const { domain } = await addDomain(db, 1, 'example.com');
    expect(await deleteDomain(db, 1, domain.id)).toBe(true);
    expect(await getDomain(db, 1, domain.id)).toBeUndefined();
  });

  it('leaves another person’s domain alone', async () => {
    const { db } = empty();
    const { domain } = await addDomain(db, 1, 'example.com');
    expect(await deleteDomain(db, 2, domain.id)).toBe(false);
    expect(await getDomain(db, 1, domain.id)).toBeDefined();
  });
});

describe('addDomain with a repository', () => {
  it('records the repository a domain was found in', async () => {
    const { db } = empty();
    const { domain } = await addDomain(db, 1, 'site.example.com', 'o/site');
    expect(domain.repo).toBe('o/site');
  });

  it('gives a domain added by hand the repository that serves it, but keeps one it has', async () => {
    const { db } = empty();
    await addDomain(db, 1, 'site.example.com');
    const tagged = await addDomain(db, 1, 'site.example.com', 'o/site');
    expect(tagged).toMatchObject({
      created: false,
      domain: { repo: 'o/site' },
    });
    const again = await addDomain(db, 1, 'site.example.com', 'o/other');
    expect(again.domain.repo).toBe('o/site');
  });
});

describe('addDomain with a source', () => {
  it('records a person as the source unless it is told another', async () => {
    const { db } = empty();
    const { domain } = await addDomain(db, 1, 'a.example.com', 'o/a');
    expect(domain).toMatchObject({ source: 'manual', environment: null });
  });

  it('records what found the site, and the environment of a deployment', async () => {
    const { db } = empty();
    const deployed = await addDomain(db, 1, 'a.example.com', 'o/a', {
      source: 'deployment',
      environment: 'prd_foo',
    });
    expect(deployed.domain).toMatchObject({
      source: 'deployment',
      environment: 'prd_foo',
    });
    const configured = await addDomain(db, 1, 'b.example.com', 'o/a', {
      source: 'config',
    });
    expect(configured.domain).toMatchObject({
      source: 'config',
      environment: null,
    });
  });

  it('keeps no environment for a source that has none, even when one is given', async () => {
    const { db } = empty();
    const { domain } = await addDomain(db, 1, 'a.example.com', 'o/a', {
      source: 'fallback',
      environment: 'production',
    });
    expect(domain.environment).toBeNull();
  });

  it('gives a site the more trusted source when two find it', async () => {
    const { db } = empty();
    await addDomain(db, 1, 'a.example.com', 'o/a', { source: 'fallback' });
    const viaConfig = await addDomain(db, 1, 'a.example.com', 'o/a', {
      source: 'config',
    });
    expect(viaConfig).toMatchObject({
      created: false,
      domain: { source: 'config' },
    });
    const viaDeployment = await addDomain(db, 1, 'a.example.com', 'o/a', {
      source: 'deployment',
      environment: 'production',
    });
    expect(viaDeployment.domain).toMatchObject({
      source: 'deployment',
      environment: 'production',
    });
    const back = await addDomain(db, 1, 'a.example.com', 'o/a', {
      source: 'fallback',
    });
    expect(back.domain.source).toBe('deployment');
  });

  it('never changes a site a person added, only tells it its repository', async () => {
    const { db } = empty();
    await addDomain(db, 1, 'a.example.com');
    const { domain } = await addDomain(db, 1, 'a.example.com', 'o/a', {
      source: 'deployment',
      environment: 'production',
    });
    expect(domain).toMatchObject({
      source: 'manual',
      environment: null,
      repo: 'o/a',
    });
  });

  it('does not let another repository take over a site', async () => {
    const { db } = empty();
    await addDomain(db, 1, 'a.example.com', 'o/a', { source: 'fallback' });
    const { domain } = await addDomain(db, 1, 'a.example.com', 'o/b', {
      source: 'deployment',
      environment: 'production',
    });
    expect(domain).toMatchObject({ repo: 'o/a', source: 'fallback' });
  });
});

describe('deleteSites', () => {
  it('removes the sites by id and says how many, leaving the others and other people alone', async () => {
    const { db } = empty();
    const { domain: a } = await addDomain(db, 1, 'a.example.com', 'o/a');
    const { domain: b } = await addDomain(db, 1, 'b.example.com', 'o/a');
    const { domain: theirs } = await addDomain(db, 2, 'a.example.com', 'o/a');
    expect(await deleteSites(db, 1, [a.id, theirs.id])).toBe(1);
    const listed = await listDomains(db, 1);
    expect(listed.map((d) => d.id)).toEqual([b.id]);
    expect(await getDomain(db, 2, theirs.id)).toBeDefined();
  });

  it('does nothing for no ids', async () => {
    const { db } = empty();
    await addDomain(db, 1, 'a.example.com');
    expect(await deleteSites(db, 1, [])).toBe(0);
    expect(await countDomains(db, 1)).toBe(1);
  });

  it('removes more than one batch of sites', async () => {
    const { db } = empty();
    const ids: string[] = [];
    for (let n = 0; n < 120; n += 1) {
      const { domain } = await addDomain(db, 1, `s${n}.example.com`);
      ids.push(domain.id);
    }
    expect(await deleteSites(db, 1, ids)).toBe(120);
    expect(await countDomains(db, 1)).toBe(0);
  });
});

describe('migration 0020_site_sources', () => {
  it('marks the sites a repository supplied as fallback and the ones added by hand as manual', async () => {
    const before = APP_MIGRATIONS.filter(
      (file) => file.localeCompare('0020_site_sources.sql') < 0,
    );
    const { db, raw } = sqliteDatabase(...before);
    raw.exec(
      `INSERT INTO domains (id, user_id, host, repo, created_at, updated_at) VALUES
        ('1', 1, 'found.example.com', 'o/site', 't', 't'),
        ('2', 1, 'hand.example.com', NULL, 't', 't')`,
    );
    raw.exec(
      await readFile(
        path.join(process.cwd(), 'migrations', '0020_site_sources.sql'),
        'utf8',
      ),
    );
    const listed = await listDomains(db, 1);
    expect(listed.map((d) => [d.host, d.source, d.environment])).toEqual([
      ['found.example.com', 'fallback', null],
      ['hand.example.com', 'manual', null],
    ]);
  });
});

describe('migration 0012_registry_domains', () => {
  it('removes registry hosts found in a repository, and keeps real sites and hosts added by hand', async () => {
    const before = APP_MIGRATIONS.filter(
      (file) => file.localeCompare('0012_registry_domains.sql') < 0,
    );
    const { raw } = sqliteDatabase(...before);
    // The database is as it was before the migration, so the rows are written
    // with the columns it had then.
    raw.exec(
      `INSERT INTO domains (id, user_id, host, repo, created_at, updated_at) VALUES
        ('1', 1, 'www.npmjs.com', 'o/lib', 't', 't'),
        ('2', 1, 'play.google.com', 'o/app', 't', 't'),
        ('3', 1, 'site.example.com', 'o/site', 't', 't'),
        ('4', 1, 'pypi.org', NULL, 't', 't')`,
    );
    raw.exec(
      await readFile(
        path.join(process.cwd(), 'migrations', '0012_registry_domains.sql'),
        'utf8',
      ),
    );
    expect(
      raw
        .prepare('SELECT host FROM domains WHERE user_id = 1 ORDER BY host')
        .all()
        .map((row) => String(row['host'])),
    ).toEqual(['pypi.org', 'site.example.com']);
  });
});

describe('removeSitesOfMissingRepos', () => {
  it('removes the sites of repositories that are not present, and says which', async () => {
    const { db } = empty();
    await addDomain(db, 1, 'a.example.com', 'o/a');
    await addDomain(db, 1, 'gone.example.com', 'o/gone');
    await addDomain(db, 1, 'by-hand.example.com');
    expect(await removeSitesOfMissingRepos(db, 1, new Set(['o/a']))).toEqual([
      'o/gone',
    ]);
    const listed = await listDomains(db, 1);
    expect(
      listed
        .map((d) => d.host)
        .toSorted((a, b) => Number(a > b) - Number(a < b)),
    ).toEqual(['a.example.com', 'by-hand.example.com']);
  });

  it("never touches another person's sites", async () => {
    const { db } = empty();
    await addDomain(db, 1, 'mine.example.com', 'o/mine');
    await addDomain(db, 2, 'theirs.example.com', 'o/mine');
    expect(await removeSitesOfMissingRepos(db, 1, new Set())).toEqual([
      'o/mine',
    ]);
    const listed = await listDomains(db, 2);
    expect(listed.map((d) => d.host)).toEqual(['theirs.example.com']);
  });

  it('removes more repositories than one query can bind', async () => {
    const { db } = empty();
    for (let n = 0; n < 120; n += 1) {
      await addDomain(db, 1, `s${n}.example.com`, `o/r${n}`);
    }
    expect(await removeSitesOfMissingRepos(db, 1, new Set())).toHaveLength(120);
    expect(await listDomains(db, 1)).toEqual([]);
  });
});
