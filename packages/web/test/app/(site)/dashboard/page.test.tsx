import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { ReactElement } from 'react';

import { createDatabase, type Database } from '@/domain/db/client';
import { addDomain } from '@/domain/db/domains';
import { hideRepo } from '@/domain/db/hidden';
import { APP_MIGRATIONS } from '../../../lib/core/db/migrations';
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
  usePathname: () => '/',
}));
jest.unstable_mockModule('@/lib/core/auth/current-user', () => ({
  getCurrentUser: async () => state.user,
}));

const { default: DashboardPage, metadata } =
  await import('@/app/(site)/dashboard/page');

let db: Database;
let restore: () => void;

beforeEach(async () => {
  state.user = { id: 1 };
  const { d1 } = sqliteD1(...APP_MIGRATIONS);
  db = createDatabase(d1);
  restore = installCloudflareContext(d1);
  await addDomain(db, 1, 'site.example.com', 'acme/site');
  await addDomain(db, 1, 'lib.example.com', 'acme/lib');
});

afterEach(() => restore());

/** Render the page, with the `hidden` query parameter if given. */
function render(hidden?: string, view?: string): Promise<ReactElement> {
  return DashboardPage({
    searchParams: Promise.resolve({
      ...(hidden === undefined ? {} : { hidden }),
      ...(view === undefined ? {} : { view }),
    }),
  });
}

/** The page's HTML. */
async function page(hidden?: string, view?: string): Promise<string> {
  return htmlAt(await render(hidden, view), { pathname: '/dashboard' });
}

describe('DashboardPage', () => {
  it('has a tab title', () => {
    expect(metadata.title).toBe('Dashboard');
  });

  it('sends someone not signed in to sign in and back here', async () => {
    state.user = null;
    await expect(render()).rejects.toEqual(
      new Redirected(
        `/auth/login?returnTo=${encodeURIComponent('/dashboard')}`,
      ),
    );
  });

  it('is a compact heading, then a table of sites with a row for each', async () => {
    const out = await page();
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain('Your sites');
    expect(out).toContain('<table');
    expect(out).toContain('Your sites and how each stands');
    for (const heading of [
      'Status',
      'Site',
      'Last deployed',
      'Last checked',
      'Commit',
      'Failed',
      'Warned',
      'Issues',
    ]) {
      expect(out).toContain(heading);
    }
    expect(out).toContain('site.example.com');
    expect(out).toContain('lib.example.com');
  });

  it('names each repository with the Octocat and links it to its page, at the site', async () => {
    const out = await page();
    expect(out).toContain('href="/repos/acme/site?site=site.example.com"');
    expect(out).toContain('href="/repos/acme/lib?site=lib.example.com"');
    expect(out).toContain('viewBox="0 0 16 16"');
  });

  it('has a search box and a switch between the table and the cards', async () => {
    const out = await page();
    expect(out).toContain('type="search"');
    expect(out).toContain('aria-label="View"');
    expect(out).toContain('href="/dashboard?view=cards"');
    expect(out).toMatch(/aria-current="true"[^>]*href="\/dashboard"/);
  });

  it('shows the cards, with more of each site, for ?view=cards', async () => {
    const out = await page(undefined, 'cards');
    expect(out).not.toContain('<table');
    expect(out).toContain('<article');
    expect(out).toContain('Deployed');
    expect(out).toContain('Checked');
    expect(out).toMatch(
      /aria-current="true"[^>]*href="\/dashboard\?view=cards"/,
    );
  });

  it('shows the table for a view it does not know', async () => {
    expect(await page(undefined, 'grid')).toContain('<table');
  });

  it('keeps the view when it lists the hidden repositories', async () => {
    await hideRepo(db, 1, 'acme/lib');
    const out = await page(undefined, 'cards');
    expect(out).toContain('href="/dashboard?view=cards&amp;hidden=1"');
  });

  it('has no form to add a domain, no badges block and no notification settings', async () => {
    const out = await page();
    expect(out).not.toContain('Add domain');
    expect(out).not.toContain('Badges');
    expect(out).not.toContain('Notifications on this device');
  });

  it('leaves a hidden repository out, and says how many are hidden', async () => {
    await hideRepo(db, 1, 'acme/lib');
    const out = await page();
    expect(out).toContain('href="/repos/acme/site?site=site.example.com"');
    expect(out).not.toContain('lib.example.com');
    expect(out).toContain('Show hidden (1)');
  });

  it('lists the hidden repository again, marked and with a way to unhide, when asked', async () => {
    await hideRepo(db, 1, 'acme/lib');
    const out = await page('1');
    expect(out).toContain('lib.example.com');
    expect(out).toContain('>Hidden<');
    expect(out).toContain('Hide hidden');
  });

  it('offers no "show hidden" when nothing is hidden', async () => {
    expect(await page()).not.toContain('Show hidden');
  });
});
