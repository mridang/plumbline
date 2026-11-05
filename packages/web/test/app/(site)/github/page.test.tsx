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
import { linkAccount, saveInstallation, saveRepos } from '@/domain/db/github';
import { APP_MIGRATIONS } from '../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../lib/core/db/sqlite-d1';
import { GITHUB_ENV } from '../../../domain/github/github-test-kit';
import { htmlAt } from '../../../components/render';

/** What the page asked Next to redirect to; `redirect` throws, as the real one does. */
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirected to ${to}`);
  }
}

/** The signed-in user, or null for nobody. */
const state: { user: { id: number; email: string } | null } = { user: null };

jest.unstable_mockModule('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));
jest.unstable_mockModule('@/lib/core/auth/current-user', () => ({
  getCurrentUser: async () => state.user,
}));

const { default: GitHubPage, metadata } =
  await import('@/app/(site)/github/page');

let db: Database;
let restore: () => void;

/** Install the Worker environment with `env`. */
function setUp(env: Record<string, unknown>): void {
  restore?.();
  const { d1 } = sqliteD1(...APP_MIGRATIONS);
  db = createDatabase(d1);
  restore = installCloudflareContext(d1, env);
}

beforeEach(() => {
  state.user = { id: 1, email: 'a@b.com' };
  setUp(GITHUB_ENV);
});

afterEach(() => restore());

/** The page as it renders for the current user. */
async function page(error?: string): Promise<string> {
  return htmlAt(
    (await GitHubPage({
      searchParams: Promise.resolve({ error }),
    })) as ReactElement,
    { pathname: '/github' },
  );
}

describe('GitHubPage', () => {
  it('is titled GitHub', () => {
    expect(metadata.title).toBe('GitHub');
  });

  it('sends someone not signed in to sign in and back here', async () => {
    state.user = null;
    await expect(page()).rejects.toEqual(
      new Redirected('/auth/login?returnTo=%2Fgithub'),
    );
  });

  it('says GitHub is not set up when the settings are missing', async () => {
    setUp({});
    const out = await page();
    expect(out).toContain('GitHub is not set up on this site');
    expect(out).not.toContain('/auth/github/link');
  });

  it('offers to install the app or connect an existing installation', async () => {
    const out = await page();
    expect(out).toContain('href="/auth/github/link?install=1"');
    expect(out).toContain('Already installed? Connect');
  });

  it('says what went wrong when the callback left a flag', async () => {
    expect(await page('taken')).toContain('already connected to someone else');
    expect(await page('nonsense')).not.toContain('role="alert"');
  });

  it('shows the connected account, its installations and the deployed repositories linked to their domains', async () => {
    await linkAccount(db, 1, { id: 9, login: 'mridang' });
    await saveInstallation(db, 1, 5, 'acme');
    await saveRepos(db, 1, 5, [
      {
        full_name: 'acme/site',
        default_branch: 'main',
        hosts: ['site.example.com'],
      },
      { full_name: 'acme/lib', default_branch: 'main', hosts: [] },
    ]);
    const { domain } = await addDomain(db, 1, 'site.example.com', 'acme/site');
    const out = await page();
    expect(out).toContain('mridang');
    expect(out).toContain('acme');
    expect(out).toContain('acme/site');
    expect(out).toContain(`href="/repos/acme/site#site-${domain.id}"`);
    expect(out).toContain('1 other repository with no deployment found');
    expect(out).not.toContain('Refresh from GitHub');
  });

  it('explains what counts as a deployment when none was found', async () => {
    await linkAccount(db, 1, { id: 9, login: 'mridang' });
    expect(await page()).toContain('None found yet');
  });

  it('says a host was not added when the domain limit stopped it', async () => {
    await linkAccount(db, 1, { id: 9, login: 'mridang' });
    await saveRepos(db, 1, 5, [
      {
        full_name: 'acme/site',
        default_branch: 'main',
        hosts: ['site.example.com'],
      },
    ]);
    expect(await page()).toContain('not added (domain limit reached)');
  });

  it('shows nobody else’s repositories', async () => {
    await linkAccount(db, 1, { id: 9, login: 'mridang' });
    await saveRepos(db, 2, 6, [
      {
        full_name: 'other/secret',
        default_branch: 'main',
        hosts: ['x.example.com'],
      },
    ]);
    expect(await page()).not.toContain('other/secret');
  });
});
