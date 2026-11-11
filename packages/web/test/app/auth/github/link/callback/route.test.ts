import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { NextRequest } from 'next/server';

import { listDomains } from '@/domain/db/domains';
import { getLink, listInstallations, listRepos } from '@/domain/db/github';
import { createDatabase } from '@/domain/db/client';
import { APP_MIGRATIONS } from '../../../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../../../lib/core/db/sqlite-d1';
import {
  DEPLOYED_APP,
  GITHUB_ENV,
  fakeGitHub,
} from '../../../../../domain/github/github-test-kit';

const state: { user: { id: number } | null } = { user: { id: 7 } };
jest.unstable_mockModule('@/lib/core/auth/current-user', () => ({
  getCurrentUser: async () => state.user,
}));

const { GET } = await import('@/app/auth/github/link/callback/route');

let restore: () => void;
let made: ReturnType<typeof sqliteD1>;

beforeEach(() => {
  state.user = { id: 7 };
  made = sqliteD1(...APP_MIGRATIONS);
  restore = installCloudflareContext(made.d1, GITHUB_ENV);
});

afterEach(() => {
  restore();
  jest.restoreAllMocks();
});

const call = (
  query: string,
  cookie: string | null = 'plumbline_github_state=github.abc',
) =>
  GET(
    new NextRequest(
      `https://plumbline.test/auth/github/link/callback${query}`,
      {
        headers: cookie ? { cookie } : {},
      },
    ),
  );

describe('GET /auth/github/link/callback', () => {
  it('links the GitHub account to the signed-in person, records their installations and reads their repositories', async () => {
    fakeGitHub(DEPLOYED_APP);
    const res = await call('?code=c1&state=github.abc');
    expect(res.headers.get('location')).toBe('https://plumbline.test/github');
    expect(res.headers.get('set-cookie')).toMatch(/plumbline_github_state=;/);
    expect(
      made.raw.prepare('SELECT user_id, repo FROM user_repositories').all(),
    ).toEqual([{ user_id: 7, repo: 'acme/site' }]);
    const db = createDatabase(made.d1);
    expect(await getLink(db, 7)).toMatchObject({
      github_id: 9,
      login: 'mridang',
    });
    const installations = await listInstallations(db, 7);
    expect(installations.map((i) => i.installation_id)).toEqual([5]);
    const repos = await listRepos(db, 7);
    expect(repos.map((r) => r.hosts)).toEqual([['site.example.com']]);
    const domains = await listDomains(db, 7);
    expect(domains.map((d) => [d.host, d.repo])).toEqual([
      ['site.example.com', 'acme/site'],
    ]);
  });

  it('refuses a state that does not match the cookie, or has no cookie', async () => {
    const mismatch = await call('?code=c1&state=github.other');
    expect(mismatch.headers.get('location')).toBe(
      'https://plumbline.test/github?error=state',
    );
    const noCookie = await call('?code=c1&state=github.abc', null);
    expect(noCookie.headers.get('location')).toBe(
      'https://plumbline.test/github?error=state',
    );
    const noState = await call('?code=c1');
    expect(noState.headers.get('location')).toBe(
      'https://plumbline.test/github?error=state',
    );
  });

  it('sends someone who is not signed in to sign in', async () => {
    state.user = null;
    const response = await call('?code=c1&state=github.abc');
    expect(response.headers.get('location')).toBe(
      'https://plumbline.test/auth/login?returnTo=%2Fgithub',
    );
  });

  it('asks to try again when GitHub sent no code', async () => {
    const response = await call('?state=github.abc');
    expect(response.headers.get('location')).toBe(
      'https://plumbline.test/github?error=code',
    );
  });

  it('says so when the GitHub account belongs to someone else', async () => {
    fakeGitHub(DEPLOYED_APP);
    made.raw
      .prepare(
        "INSERT INTO github_links VALUES (3, 9, 'mridang', 'now', 'now')",
      )
      .run();
    const response = await call('?code=c1&state=github.abc');
    expect(response.headers.get('location')).toBe(
      'https://plumbline.test/github?error=taken',
    );
  });

  it('reports a failure to reach GitHub without details', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeGitHub({
      'https://github.com/login/oauth/access_token': () =>
        new Response('no', { status: 500 }),
    });
    const response = await call('?code=c1&state=github.abc');
    expect(response.headers.get('location')).toBe(
      'https://plumbline.test/github?error=failed',
    );
  });

  it('says so when the connection worked but no installation could be read', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeGitHub({
      ...DEPLOYED_APP,
      'https://api.github.com/app/installations/5/access_tokens': () =>
        new Response('{}', { status: 401 }),
    });
    const response = await call('?code=c1&state=github.abc');
    expect(response.headers.get('location')).toBe(
      'https://plumbline.test/github?error=read',
    );
  });

  it('says so when GitHub is not set up', async () => {
    restore();
    restore = installCloudflareContext(made.d1, {});
    const response = await call('?code=c1&state=github.abc');
    expect(response.headers.get('location')).toBe(
      'https://plumbline.test/github?error=unavailable',
    );
  });
});
