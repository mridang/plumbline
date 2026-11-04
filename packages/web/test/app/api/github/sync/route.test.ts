import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { saveInstallation } from '@/domain/db/github';
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

const state: { user: { id: number } | null } = { user: { id: 7 } };
jest.unstable_mockModule('@/lib/core/auth/current-user', () => ({
  getCurrentUser: async () => state.user,
}));

const { POST } = await import('@/app/api/github/sync/route');

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

const post = (headers: Record<string, string> = {}) =>
  POST(
    new Request('https://plumbline.test/api/github/sync', {
      method: 'POST',
      headers,
    }),
  );

describe('POST /api/github/sync', () => {
  it("reads the person's installations and says what it found", async () => {
    await saveInstallation(createDatabase(made.d1), 7, 5, 'acme');
    fakeGitHub(DEPLOYED_APP);
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      repositories: 1,
      deployed: 1,
      domainsAdded: 1,
    });
  });

  it('skips an installation that fails and still answers', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await saveInstallation(createDatabase(made.d1), 7, 5, 'acme');
    fakeGitHub({
      'https://api.github.com/app/installations/5/access_tokens': () =>
        new Response('no', { status: 404 }),
    });
    const res = await post();
    expect(await res.json()).toEqual({
      repositories: 0,
      deployed: 0,
      domainsAdded: 0,
    });
  });

  it('refuses a request from another site, someone not signed in, and a site without GitHub', async () => {
    expect((await post({ 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    state.user = null;
    expect((await post()).status).toBe(401);
    state.user = { id: 7 };
    restore();
    restore = installCloudflareContext(made.d1, {});
    expect((await post()).status).toBe(503);
  });
});
