import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { NextRequest } from 'next/server';

import { installCloudflareContext } from '../../../../lib/core/db/sqlite-d1';
import { GITHUB_ENV } from '../../../../domain/github/github-test-kit';

const state: { user: { id: number } | null } = { user: { id: 1 } };
jest.unstable_mockModule('@/lib/core/auth/current-user', () => ({
  getCurrentUser: async () => state.user,
}));

const { GET } = await import('@/app/auth/github/link/route');

let restore: () => void;
afterEach(() => restore());

const get = (query = '') =>
  GET(new NextRequest(`https://plumbline.test/auth/github/link${query}`));

describe('GET /auth/github/link', () => {
  beforeEach(() => {
    state.user = { id: 1 };
    restore = installCloudflareContext({} as D1Database, GITHUB_ENV);
  });

  it('sends the person to approve the app, keeping the state in a cookie', async () => {
    const res = await get();
    const target = new URL(res.headers.get('location') ?? '');
    expect(target.origin + target.pathname).toBe(
      'https://github.com/login/oauth/authorize',
    );
    expect(target.searchParams.get('redirect_uri')).toBe(
      'https://plumbline.test/auth/github/link/callback',
    );
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(
      `plumbline_github_state=${target.searchParams.get('state')}`,
    );
    expect(cookie).toMatch(/httponly/i);
    expect(cookie).toMatch(/secure/i);
  });

  it('sends the person to install the app with ?install', async () => {
    const res = await get('?install=1');
    const target = new URL(res.headers.get('location') ?? '');
    expect(target.pathname).toBe('/apps/plumbline-test/installations/new');
    expect(target.searchParams.get('state')).toMatch(/^github\./);
  });

  it('sends someone who is not signed in to sign in first', async () => {
    state.user = null;
    const res = await get();
    expect(res.headers.get('location')).toBe(
      'https://plumbline.test/auth/login?returnTo=%2Fgithub',
    );
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('says so when GitHub is not set up', async () => {
    restore();
    restore = installCloudflareContext({} as D1Database, {});
    const res = await get();
    expect(res.headers.get('location')).toBe(
      'https://plumbline.test/github?error=unavailable',
    );
  });
});
