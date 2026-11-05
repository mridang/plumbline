import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { NextRequest } from 'next/server';

import { GET } from '@/app/auth/github/callback/route';
import { SessionTokens } from '@/lib/session';

import { APP_MIGRATIONS } from '../../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../../lib/core/db/sqlite-d1';
import {
  DEPLOYED_APP,
  GITHUB_ENV,
  fakeGitHub,
} from '../../../../domain/github/github-test-kit';

let restore: () => void;
let made: ReturnType<typeof sqliteD1>;

beforeEach(() => {
  made = sqliteD1(...APP_MIGRATIONS);
  restore = installCloudflareContext(made.d1, {
    ...GITHUB_ENV,
    SESSION_SECRET: 'a-session-secret-that-is-long-enough-to-sign-with',
  });
});
afterEach(() => {
  restore();
  jest.restoreAllMocks();
});

const call = (
  query: string,
  cookie: string | null = 'plumbline_oauth_state=s1',
) =>
  GET(
    new NextRequest(`https://plumbline.test/auth/github/callback${query}`, {
      headers: cookie ? { cookie } : {},
    }),
  );

const flag = (response: Response) => response.headers.get('location');

describe('GET /auth/github/callback', () => {
  it('signs the person in, keeps the repositories they can see, and lands on the dashboard', async () => {
    fakeGitHub(DEPLOYED_APP);
    const response = await call('?code=c1&state=s1');
    expect(flag(response)).toBe('https://plumbline.test/dashboard');
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('plumbline_session=');
    const user = made.raw.prepare('SELECT id, google_sub FROM users').get();
    expect(user?.['google_sub']).toBe('github:9');
    expect(
      made.raw.prepare('SELECT repo FROM user_repositories').all(),
    ).toEqual([{ repo: 'acme/site' }]);
    const token = /plumbline_session=([^;]+)/.exec(cookie)?.[1] ?? '';
    const claims = await new SessionTokens(
      'a-session-secret-that-is-long-enough-to-sign-with',
    ).verify(token);
    expect(claims?.uid).toBe(user?.['id']);
  });

  it('lands where the person was going, when they came from somewhere specific', async () => {
    fakeGitHub(DEPLOYED_APP);
    const response = await call(
      '?code=c1&state=s1',
      'plumbline_oauth_state=s1; plumbline_return_to=%2Fdomains',
    );
    expect(flag(response)).toBe('https://plumbline.test/domains');
  });

  it.each([
    ['no state cookie', '?code=c1&state=s1', null, 'auth'],
    [
      'a state that does not match',
      '?code=c1&state=other',
      'plumbline_oauth_state=s1',
      'auth',
    ],
    [
      'a person who pressed Cancel',
      '?state=s1&error=access_denied',
      'plumbline_oauth_state=s1',
      'denied',
    ],
  ])(
    'sends %s back to the sign-in page, signing no one in',
    async (_name, query, cookie, expected) => {
      const response = await call(query, cookie);
      expect(flag(response)).toBe(
        `https://plumbline.test/login?error=${expected}`,
      );
      expect(response.headers.get('set-cookie') ?? '').not.toContain(
        'plumbline_session=',
      );
      expect(made.raw.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual(
        { n: 0 },
      );
    },
  );

  it('shows a failure of GitHub as a fixed flag, never what GitHub said', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeGitHub({
      'https://github.com/login/oauth/access_token': () =>
        new Response('secret detail', { status: 500 }),
    });
    const response = await call('?code=c1&state=s1');
    expect(flag(response)).toBe('https://plumbline.test/login?error=auth');
    expect(response.headers.get('set-cookie') ?? '').not.toContain('secret');
  });

  it('sends people to the sign-in page when the app has no GitHub settings', async () => {
    restore();
    restore = installCloudflareContext(made.d1, {});
    expect(flag(await call('?code=c1&state=s1'))).toBe(
      'https://plumbline.test/login?error=github',
    );
  });
});
