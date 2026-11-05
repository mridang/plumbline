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
function render(hidden?: string): Promise<ReactElement> {
  return DashboardPage({
    searchParams: Promise.resolve(hidden === undefined ? {} : { hidden }),
  });
}

/** The page's HTML. */
async function page(hidden?: string): Promise<string> {
  return htmlAt(await render(hidden), { pathname: '/dashboard' });
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

  it('lists a card for each repository, titled with its name and linked to its page', async () => {
    const out = await page();
    expect(out).toContain('href="/repos/acme/site"');
    expect(out).toContain('href="/repos/acme/lib"');
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
    expect(out).toContain('href="/repos/acme/site"');
    expect(out).not.toContain('href="/repos/acme/lib"');
    expect(out).toContain('Show hidden (1)');
  });

  it('lists the hidden repository again, dimmed with a way to unhide, when asked', async () => {
    await hideRepo(db, 1, 'acme/lib');
    const out = await page('1');
    expect(out).toContain('href="/repos/acme/lib"');
    expect(out).toContain('>Unhide<');
    expect(out).toContain('Hide hidden');
  });

  it('offers no "show hidden" when nothing is hidden', async () => {
    expect(await page()).not.toContain('Show hidden');
  });
});
