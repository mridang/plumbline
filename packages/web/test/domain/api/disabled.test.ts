import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import type { CurrentUserResolver } from '@/domain/api/auth';
import { createDisabledRepository } from '@/domain/api/disabled';
import { createDatabase } from '@/domain/db/client';
import { disableRepo, isRepoDisabled } from '@/domain/db/disabled';
import { addDomain } from '@/domain/db/domains';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../lib/core/db/sqlite-d1';

/** Who is signed in; null means nobody. */
const session: { uid: number | null } = { uid: 7 };

const resolver: CurrentUserResolver = {
  currentUid: async () => session.uid,
  currentLiveUid: async () => session.uid,
  currentUser: async () => null,
};

/** The closings handed to the background, so the tests can wait for them. */
let jobs: Promise<unknown>[];

const disabled = () =>
  createDisabledRepository(resolver, {
    config: null,
    background: (work) => jobs.push(work),
  }).handlers();
const ORIGIN = 'https://plumbline.test';

let db: ReturnType<typeof createDatabase>;
let restore: () => void;

beforeEach(async () => {
  session.uid = 7;
  jobs = [];
  const made = sqliteD1(...APP_MIGRATIONS);
  restore = installCloudflareContext(made.d1);
  db = createDatabase(made.d1);
  await addDomain(db, 7, 'site.example.com', 'acme/site');
});

afterEach(() => restore());

/** A request to turn the checks of `owner/repo` off (PUT) or on (DELETE). */
const call = (
  method: 'PUT' | 'DELETE',
  owner: string,
  repo: string,
  headers: Record<string, string> = {},
) =>
  disabled()[method](
    new Request(
      `${ORIGIN}/api/users/self/repositories/disabled/${owner}/${repo}`,
      { method, headers },
    ),
    { params: Promise.resolve({ owner, repo }) },
  );

describe('PUT /api/users/self/repositories/disabled/{owner}/{repo}', () => {
  it('turns the checks off with 204, also the second time, and closes issues once', async () => {
    expect((await call('PUT', 'acme', 'site')).status).toBe(204);
    expect((await call('PUT', 'acme', 'site')).status).toBe(204);
    expect(await isRepoDisabled(db, 'acme/site')).toBe(true);
    expect(jobs).toHaveLength(1);
    await Promise.all(jobs);
  });

  it('answers 404 as a problem for a repository the person cannot see', async () => {
    const response = await call('PUT', 'acme', 'other');
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json',
    );
    expect(await isRepoDisabled(db, 'acme/other')).toBe(false);
  });

  it('answers 404 for a name that cannot be a repository', async () => {
    expect((await call('PUT', 'acme', '..')).status).toBe(404);
  });

  it('answers 401 without a session and 403 across sites', async () => {
    session.uid = null;
    expect((await call('PUT', 'acme', 'site')).status).toBe(401);
    session.uid = 7;
    expect(
      (await call('PUT', 'acme', 'site', { origin: 'https://evil.test' }))
        .status,
    ).toBe(403);
    expect(await isRepoDisabled(db, 'acme/site')).toBe(false);
  });
});

describe('DELETE /api/users/self/repositories/disabled/{owner}/{repo}', () => {
  it('turns the checks on with 204', async () => {
    await disableRepo(db, 7, 'acme/site');
    expect((await call('DELETE', 'acme', 'site')).status).toBe(204);
    expect(await isRepoDisabled(db, 'acme/site')).toBe(false);
  });

  it('answers 404 when the checks were not off', async () => {
    expect((await call('DELETE', 'acme', 'site')).status).toBe(404);
  });

  it('answers 404 for a repository the person cannot see, and leaves it off', async () => {
    await disableRepo(db, 9, 'acme/other');
    expect((await call('DELETE', 'acme', 'other')).status).toBe(404);
    expect(await isRepoDisabled(db, 'acme/other')).toBe(true);
  });

  it('answers 401 without a session', async () => {
    session.uid = null;
    expect((await call('DELETE', 'acme', 'site')).status).toBe(401);
  });
});
