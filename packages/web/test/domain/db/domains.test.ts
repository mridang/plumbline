import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  addDomain,
  countDomains,
  deleteDomain,
  domainOf,
  findDomainByHost,
  getDomain,
  listDomains,
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
    expect((await addDomain(db, 2, 'example.com')).created).toBe(true);
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
    expect((await listDomains(db, 1)).map((d) => d.host)).toEqual([
      'a.example',
      'b.example',
    ]);
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
    expect((await getDomain(db, 1, domain.id))?.checks).toEqual(['hsts']);
  });

  it('goes back to every check for null', async () => {
    const { db } = empty();
    const { domain } = await addDomain(db, 1, 'example.com');
    await setDomainChecks(db, 1, domain.id, ['hsts']);
    expect((await setDomainChecks(db, 1, domain.id, null))?.checks).toBeNull();
  });

  it('changes nothing of another person’s domain', async () => {
    const { db } = empty();
    const { domain } = await addDomain(db, 1, 'example.com');
    expect(await setDomainChecks(db, 2, domain.id, ['hsts'])).toBeUndefined();
    expect((await getDomain(db, 1, domain.id))?.checks).toBeNull();
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
