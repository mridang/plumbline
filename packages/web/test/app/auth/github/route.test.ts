import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { NextRequest } from 'next/server';

import { GET } from '@/app/auth/github/route';

import { APP_MIGRATIONS } from '../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../lib/core/db/sqlite-d1';
import { GITHUB_ENV } from '../../../domain/github/github-test-kit';

let restore: () => void;

const start = (query = '') =>
  GET(new NextRequest(`https://plumbline.test/auth/github${query}`));

beforeEach(() => {
  restore = installCloudflareContext(
    sqliteD1(...APP_MIGRATIONS).d1,
    GITHUB_ENV,
  );
});
afterEach(() => restore());

describe('GET /auth/github', () => {
  it('sends the browser to GitHub with a one-time state it remembers in a cookie', async () => {
    const response = start();
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.origin + location.pathname).toBe(
      'https://github.com/login/oauth/authorize',
    );
    expect(location.searchParams.get('redirect_uri')).toBe(
      'https://plumbline.test/auth/github/callback',
    );
    const state = location.searchParams.get('state');
    expect(state).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get('set-cookie')).toContain(
      `plumbline_oauth_state=${state}`,
    );
  });

  it('remembers where to land afterwards, when it is a path on this site', async () => {
    const kept = start('?returnTo=%2Fdashboard');
    expect(kept.headers.get('set-cookie')).toContain(
      'plumbline_return_to=%2Fdashboard',
    );
    const refused = start('?returnTo=https%3A%2F%2Fevil.test');
    expect(refused.headers.get('set-cookie')).not.toContain('evil');
  });

  it('sends people back to the sign-in page when the app has no GitHub settings', async () => {
    restore();
    restore = installCloudflareContext(sqliteD1(...APP_MIGRATIONS).d1, {});
    expect(start().headers.get('location')).toBe(
      'https://plumbline.test/login?error=github',
    );
  });
});
