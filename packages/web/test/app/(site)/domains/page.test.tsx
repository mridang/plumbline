import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { ReactElement } from 'react';

import { CHECKS } from '@/domain/checks/catalogue';
import { createDatabase, type Database } from '@/domain/db/client';
import { addDomain, setDomainChecks } from '@/domain/db/domains';
import { saveReport } from '@/domain/db/reports';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../lib/core/db/sqlite-d1';
import { htmlAt } from '../../../components/render';

/** What the page asked Next to redirect to; `redirect` throws, as the real one does. */
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirected to ${to}`);
  }
}

/** The signed-in user, or null for nobody. */
const state: { user: { id: number } | null } = { user: null };

jest.unstable_mockModule('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));
jest.unstable_mockModule('@/lib/core/auth/current-user', () => ({
  getCurrentUser: async () => state.user,
}));

const { default: DomainsPage, metadata } =
  await import('@/app/(site)/domains/page');

let db: Database;
let restore: () => void;

beforeEach(() => {
  state.user = { id: 1 };
  const { d1 } = sqliteD1('0001_init.sql');
  db = createDatabase(d1);
  restore = installCloudflareContext(d1);
});

afterEach(() => restore());

/** The page as it renders for the current user. */
async function page(): Promise<string> {
  return htmlAt((await DomainsPage()) as ReactElement, {
    pathname: '/domains',
  });
}

describe('DomainsPage', () => {
  it('is titled for the domains', () => {
    expect(metadata.title).toBe('Your domains');
  });

  it('sends someone not signed in to sign in and back here', async () => {
    state.user = null;
    await expect(DomainsPage()).rejects.toEqual(
      new Redirected('/auth/login?returnTo=%2Fdomains'),
    );
  });

  it('says there are no domains yet', async () => {
    expect(await page()).toContain('No domains yet. Add one above.');
  });

  it('offers the box to add a domain', async () => {
    expect(await page()).toContain('Add domain');
  });

  it('links each domain to its page', async () => {
    const { domain } = await addDomain(db, 1, 'example.com');
    expect(await page()).toContain(`href="/domains/${domain.id}"`);
  });

  it('counts the checks that run for a domain', async () => {
    const { domain } = await addDomain(db, 1, 'example.com');
    await setDomainChecks(db, 1, domain.id, ['csp', 'etag']);
    expect(await page()).toContain(`2 of ${CHECKS.length} checks`);
  });

  it('says a domain that was never scanned has not been', async () => {
    await addDomain(db, 1, 'example.com');
    expect(await page()).toContain('Not scanned yet');
  });

  it('shows how the newest scan went', async () => {
    const { domain } = await addDomain(db, 1, 'example.com');
    await saveReport(db, 1, domain.id, {
      url: 'https://example.com/',
      passed: 7,
      warned: 2,
      failed: 3,
      skipped: 0,
      outcomes: [],
    });
    expect(await page()).toMatch(/3 failed.*2 warned.*7 passed/s);
  });

  it('shows nobody else’s domains', async () => {
    await addDomain(db, 2, 'someone-else.example');
    expect(await page()).not.toContain('someone-else.example');
  });
});
