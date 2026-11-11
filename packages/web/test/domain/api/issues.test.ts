import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- experimental API used on purpose
import type { DatabaseSync } from 'node:sqlite';

import type { CurrentUserResolver } from '@/domain/api/auth';
import { createIssuesCollection } from '@/domain/api/issues';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../lib/core/db/sqlite-d1';

const session: { uid: number | null } = { uid: 7 };
const resolver: CurrentUserResolver = {
  currentUid: async () => session.uid,
  currentLiveUid: async () => session.uid,
  currentUser: async () => null,
};
const collection = createIssuesCollection(resolver).handlers();

const ORIGIN = 'https://plumbline.test';
const DOMAIN = '00000000-0000-4000-8000-000000000001';
const NO_REPO = '00000000-0000-4000-8000-000000000002';

let raw: DatabaseSync;
let restore: () => void;

beforeEach(() => {
  session.uid = 7;
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
  raw
    .prepare(
      "INSERT INTO domains (id, user_id, host, repo, created_at, updated_at) VALUES (?, 7, 'x.test', 'a/b', 'now', 'now')",
    )
    .run(DOMAIN);
  raw
    .prepare(
      "INSERT INTO domains (id, user_id, host, created_at, updated_at) VALUES (?, 7, 'y.test', 'now', 'now')",
    )
    .run(NO_REPO);
  raw
    .prepare(
      "INSERT INTO suite_issue_history (repo, host, number, state, opened_at, checks) VALUES ('a/b', 'x.test', 3, 'open', '2026-01-02T00:00:00.000Z', '[\"csp\"]'), ('a/b', 'x.test', 2, 'fixed', '2026-01-01T00:00:00.000Z', '[\"hsts\"]'), ('a/b', 'x.test', 1, 'deleted', '2025-12-01T00:00:00.000Z', '[]')",
    )
    .run();
});

afterEach(() => restore());

const list = (id = DOMAIN) =>
  collection.GET(new Request(`${ORIGIN}/api/domains/${id}/issues`), {
    params: Promise.resolve({ id }),
  });

describe('GET /api/domains/{id}/issues', () => {
  it('lists the issues of the site, newest first, privately, leaving out deleted ones', async () => {
    const response = await list();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
    expect(await response.json()).toEqual({
      self: `${ORIGIN}/api/domains/${DOMAIN}/issues`,
      items: [
        {
          number: 3,
          state: 'open',
          opened_at: '2026-01-02T00:00:00.000Z',
          checks: ['csp'],
        },
        {
          number: 2,
          state: 'fixed',
          opened_at: '2026-01-01T00:00:00.000Z',
          checks: ['hsts'],
        },
      ],
    });
  });

  it('lists none for a domain no repository serves', async () => {
    const response = await list(NO_REPO);
    expect(await response.json()).toMatchObject({ items: [] });
  });

  it('answers 404 as a problem for a domain that is not the caller’s or does not exist', async () => {
    session.uid = 8;
    const response = await list();
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json',
    );
    session.uid = 7;
    const malformed = await list('not-an-id');
    expect(malformed.status).toBe(404);
  });

  it('answers 401 without a session', async () => {
    session.uid = null;
    const response = await list();
    expect(response.status).toBe(401);
  });
});
