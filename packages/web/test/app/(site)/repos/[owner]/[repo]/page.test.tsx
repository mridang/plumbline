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
import { replaceAccess } from '@/domain/db/access';
import { APP_MIGRATIONS } from '../../../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../../../lib/core/db/sqlite-d1';
import { htmlAt } from '../../../../../components/render';

/** What the page asked Next to redirect to; `redirect` throws, as the real one does. */
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirected to ${to}`);
  }
}

/** Thrown by `notFound`, as the real one throws. */
class NotFound extends Error {}

/** The signed-in user, or null for nobody. */
const state: { user: { id: number } | null } = { user: null };

jest.unstable_mockModule('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
  notFound: () => {
    throw new NotFound();
  },
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));
// The history is an async server component with its own tests; here it only
// has to be given the repository and the hosts the person keeps.
jest.unstable_mockModule('@/components/runs/run-history', () => ({
  RunHistory: ({ repo, hosts }: { repo: string; hosts: readonly string[] }) => (
    <p>
      History of {repo}: {hosts.join(', ')}
    </p>
  ),
}));
jest.unstable_mockModule('@/lib/core/auth/current-user', () => ({
  getCurrentUser: async () => state.user,
}));

const { default: RepoPage, metadata } =
  await import('@/app/(site)/repos/[owner]/[repo]/page');

let db: Database;
let restore: () => void;

beforeEach(async () => {
  state.user = { id: 1 };
  const { d1 } = sqliteD1(...APP_MIGRATIONS);
  db = createDatabase(d1);
  restore = installCloudflareContext(d1, { SESSION_SECRET: 'a-secret' });
  await addDomain(db, 1, 'site.example.com', 'acme/site');
});

afterEach(() => restore());

/** Render the page for a repository. */
function render(owner: string, repo: string): Promise<ReactElement> {
  return RepoPage({
    params: Promise.resolve({ owner, repo }),
    searchParams: Promise.resolve({}),
  });
}

/** The page's HTML. */
async function page(owner = 'acme', repo = 'site'): Promise<string> {
  return htmlAt(await render(owner, repo), {
    pathname: `/repos/${owner}/${repo}`,
  });
}

describe('RepoPage', () => {
  it('has a tab title', () => {
    expect(metadata.title).toBe('Repository');
  });

  it('sends someone not signed in to sign in and back to this repository', async () => {
    state.user = null;
    await expect(render('acme', 'site')).rejects.toEqual(
      new Redirected(
        `/auth/login?returnTo=${encodeURIComponent('/repos/acme/site')}`,
      ),
    );
  });

  it('is not found for a name that cannot be a repository', async () => {
    await expect(render('acme', '..')).rejects.toBeInstanceOf(NotFound);
  });

  it('is not found for a repository the person cannot see', async () => {
    await addDomain(db, 2, 'other.example.com', 'acme/other');
    await expect(render('acme', 'other')).rejects.toBeInstanceOf(NotFound);
  });

  it('is headed with the repository and links to it on GitHub', async () => {
    const out = await page();
    expect(out).toContain('acme/site</h1>');
    expect(out).toContain('href="https://github.com/acme/site"');
  });

  it('has the badge, to paste into the README', async () => {
    const out = await page();
    expect(out).toContain('Badge');
    expect(out).toMatch(/\/badge\/acme\/site\/[0-9a-f]{20}\.svg/);
  });

  it('lets the person run the checks for a site they keep, and choose its checks', async () => {
    const out = await page();
    expect(out).toContain('site.example.com');
    expect(out).toMatch(/Run \d+ checks/);
    expect(out).toContain('Choose the checks');
  });

  it('shows how a site someone else keeps stands, without controls', async () => {
    await addDomain(db, 2, 'theirs.example.com', 'acme/site');
    await replaceAccess(db, 1, ['acme/site']);
    const out = await page();
    expect(out).toContain('Other sites of this repository');
    expect(out).toContain('theirs.example.com');
    expect(out).not.toContain('id="site-theirs');
  });

  it('shows the history of the sites the person keeps, and not of others’', async () => {
    await addDomain(db, 2, 'theirs.example.com', 'acme/site');
    await replaceAccess(db, 1, ['acme/site']);
    expect(await page()).toContain(
      'History of acme/site: site.example.com</p>',
    );
  });
});
