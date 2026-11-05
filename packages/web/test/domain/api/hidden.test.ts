import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import type { CurrentUserResolver } from '@/domain/api/auth';
import { createHiddenRepository, repoOf } from '@/domain/api/hidden';
import { createDatabase } from '@/domain/db/client';
import { addDomain } from '@/domain/db/domains';
import { hideRepo, listHidden } from '@/domain/db/hidden';
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

const hidden = createHiddenRepository(resolver).handlers();
const ORIGIN = 'https://plumbline.test';

let db: ReturnType<typeof createDatabase>;
let restore: () => void;

beforeEach(async () => {
  session.uid = 7;
  const made = sqliteD1(...APP_MIGRATIONS);
  restore = installCloudflareContext(made.d1);
  db = createDatabase(made.d1);
  await addDomain(db, 7, 'site.example.com', 'acme/site');
});

afterEach(() => restore());

/** A request to hide or show `owner/repo`. */
const call = (
  method: 'PUT' | 'DELETE',
  owner: string,
  repo: string,
  headers: Record<string, string> = {},
) =>
  hidden[method](
    new Request(
      `${ORIGIN}/api/users/self/repositories/hidden/${owner}/${repo}`,
      { method, headers },
    ),
    { params: Promise.resolve({ owner, repo }) },
  );

describe('repoOf', () => {
  it('joins a GitHub owner and name, and refuses what cannot be one', () => {
    expect(repoOf('acme', 'site.js')).toBe('acme/site.js');
    expect(repoOf('', 'site')).toBeNull();
    expect(repoOf('ac me', 'site')).toBeNull();
    expect(repoOf('acme', '..')).toBeNull();
    expect(repoOf('acme', 'a/b')).toBeNull();
    expect(repoOf('-'.repeat(40), 'site')).toBeNull();
  });
});

describe('PUT /api/users/self/repositories/hidden/{owner}/{repo}', () => {
  it('hides the repository with 204, also the second time', async () => {
    expect((await call('PUT', 'acme', 'site')).status).toBe(204);
    expect((await call('PUT', 'acme', 'site')).status).toBe(204);
    expect([...(await listHidden(db, 7))]).toEqual(['acme/site']);
  });

  it('answers 404 as a problem for a repository the person cannot see', async () => {
    const response = await call('PUT', 'acme', 'other');
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json',
    );
    expect((await listHidden(db, 7)).size).toBe(0);
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
  });
});

describe('DELETE /api/users/self/repositories/hidden/{owner}/{repo}', () => {
  it('shows the repository again with 204', async () => {
    await hideRepo(db, 7, 'acme/site');
    expect((await call('DELETE', 'acme', 'site')).status).toBe(204);
    expect((await listHidden(db, 7)).size).toBe(0);
  });

  it('answers 404 when it was not hidden', async () => {
    expect((await call('DELETE', 'acme', 'site')).status).toBe(404);
  });

  it('answers 401 without a session', async () => {
    session.uid = null;
    expect((await call('DELETE', 'acme', 'site')).status).toBe(401);
  });
});
