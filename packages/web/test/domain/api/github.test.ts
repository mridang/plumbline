import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type { CurrentUserResolver } from '@/domain/api/auth';
import { createGithubLink, createGithubSyncs } from '@/domain/api/github';
import { linkAccount } from '@/domain/db/github';
import { createDatabase } from '@/domain/db/client';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../lib/core/db/sqlite-d1';
import {
  DEPLOYED_APP,
  GITHUB_ENV,
  fakeGitHub,
} from '../github/github-test-kit';

const session: { uid: number | null } = { uid: 7 };
const resolver: CurrentUserResolver = {
  currentUid: async () => session.uid,
  currentLiveUid: async () => session.uid,
  currentUser: async () => null,
};

const ORIGIN = 'https://plumbline.test';
const syncs = createGithubSyncs(resolver).handlers();
const link = createGithubLink(resolver).handlers();

let made: ReturnType<typeof sqliteD1>;
let restore: () => void;

beforeEach(() => {
  session.uid = 7;
  made = sqliteD1(...APP_MIGRATIONS);
  restore = installCloudflareContext(made.d1, GITHUB_ENV);
});
afterEach(() => {
  restore();
  jest.restoreAllMocks();
});

const post = (headers: Record<string, string> = {}) =>
  syncs.POST(
    new Request(`${ORIGIN}/api/github/syncs`, { method: 'POST', headers }),
  );
const del = (headers: Record<string, string> = {}) =>
  link.DELETE(
    new Request(`${ORIGIN}/api/users/self/github`, {
      method: 'DELETE',
      headers,
    }),
  );

describe('POST /api/github/syncs', () => {
  it('reads the installations again and says what was found, in snake_case', async () => {
    const db = createDatabase(made.d1);
    await linkAccount(db, 7, { id: 9, login: 'mridang' });
    made.raw
      .prepare(
        "INSERT INTO github_installations (installation_id, user_id, account_login, created_at, updated_at) VALUES (5, 7, 'acme', 'now', 'now')",
      )
      .run();
    fakeGitHub(DEPLOYED_APP);
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      repositories: 1,
      deployed: 1,
      domains_added: 1,
    });
  });

  it('answers 502 as a problem naming the installation when none could be read', async () => {
    const db = createDatabase(made.d1);
    await linkAccount(db, 7, { id: 9, login: 'mridang' });
    made.raw
      .prepare(
        "INSERT INTO github_installations (installation_id, user_id, account_login, created_at, updated_at) VALUES (5, 7, 'acme', 'now', 'now')",
      )
      .run();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 401 }));
    const response = await post();
    expect(response.status).toBe(502);
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json',
    );
    expect(await response.json()).toMatchObject({
      detail: 'acme: GitHub refused an installation token (401)',
    });
  });

  it('answers 401 as a problem without a session, and 403 across sites', async () => {
    session.uid = null;
    const refused = await post();
    expect(refused.status).toBe(401);
    expect(refused.headers.get('content-type')).toBe(
      'application/problem+json',
    );
    session.uid = 7;
    expect((await post({ origin: 'https://evil.test' })).status).toBe(403);
  });

  it('answers 503 as a problem when the site has no GitHub settings', async () => {
    restore();
    restore = installCloudflareContext(made.d1, {});
    const response = await post();
    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json',
    );
  });
});

describe('DELETE /api/users/self/github', () => {
  it('forgets the connected account, with its installations', async () => {
    const db = createDatabase(made.d1);
    await linkAccount(db, 7, { id: 9, login: 'mridang' });
    expect((await del()).status).toBe(204);
    expect(
      made.raw.prepare('SELECT COUNT(*) AS n FROM github_links').get(),
    ).toEqual({
      n: 0,
    });
  });

  it('answers 404 as a problem when no account is connected', async () => {
    const response = await del();
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json',
    );
  });

  it('forgets no one else’s account', async () => {
    const db = createDatabase(made.d1);
    await linkAccount(db, 8, { id: 10, login: 'other' });
    expect((await del()).status).toBe(404);
    expect(
      made.raw.prepare('SELECT COUNT(*) AS n FROM github_links').get(),
    ).toEqual({
      n: 1,
    });
  });

  it('answers 401 without a session and 403 across sites', async () => {
    session.uid = null;
    expect((await del()).status).toBe(401);
    session.uid = 7;
    expect((await del({ origin: 'https://evil.test' })).status).toBe(403);
  });
});
