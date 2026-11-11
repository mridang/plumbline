import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- experimental API used on purpose
import type { DatabaseSync } from 'node:sqlite';

import type { CurrentUserResolver } from '@/domain/api/auth';
import {
  createRunItem,
  createRunsCollection,
  isRunId,
} from '@/domain/api/runs';
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

const collection = createRunsCollection(resolver).handlers();
const item = createRunItem(resolver).handlers();

const ORIGIN = 'https://plumbline.test';
const DOMAIN = '00000000-0000-4000-8000-000000000001';
const REPORT = '00000000-0000-4000-8000-0000000000aa';
const OUTCOMES = JSON.stringify([
  { id: 'accept-ch', status: 'passed', findings: [] },
]);

let raw: DatabaseSync;
let restore: () => void;

beforeEach(() => {
  session.uid = 7;
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
  raw
    .prepare(
      "INSERT INTO domains (id, user_id, host, created_at, updated_at) VALUES (?, 7, 'example.com', 'now', 'now')",
    )
    .run(DOMAIN);
  raw
    .prepare(
      "INSERT INTO reports (id, domain_id, user_id, url, passed, warned, failed, skipped, outcomes, created_at, sha) VALUES (?, ?, 7, 'https://example.com/', 5, 1, 0, 0, ?, '2026-01-01T10:00:00.000Z', 'abc1234')",
    )
    .run(REPORT, DOMAIN, OUTCOMES);
});

afterEach(() => restore());

const params = (id = DOMAIN, runId = '') => ({
  params: Promise.resolve({ id, 'run-id': runId }),
});

/** Store a server run of the host. */
function seedRun(ranAt: string, outcomes: string | null = OUTCOMES) {
  raw
    .prepare(
      "INSERT INTO suite_runs (user_id, host, repo, sha, status, ran_at, findings, kind, passed, warned, failed, skipped, outcomes) VALUES (7, 'example.com', 'a/b', 'def5678', 200, ?, '[]', 'scheduled', 9, 2, 1, 0, ?)",
    )
    .run(ranAt, outcomes);
}

const list = (query = '', id = DOMAIN) =>
  collection.GET(
    new Request(`${ORIGIN}/api/domains/${id}/runs${query}`),
    params(id),
  );

const read = (runId: string, id = DOMAIN) =>
  item.GET(
    new Request(`${ORIGIN}/api/domains/${id}/runs/${runId}`),
    params(id, runId),
  );

describe('isRunId', () => {
  it('takes a report’s UUID and a server run’s s and number, and nothing else', () => {
    expect(isRunId(REPORT)).toBe(true);
    expect(isRunId('s42')).toBe(true);
    for (const id of ['', 's', 's0', '42', 'report', `${REPORT}x`]) {
      expect(isRunId(id)).toBe(false);
    }
  });
});

describe('GET /api/domains/{id}/runs', () => {
  it('lists manual and server runs together, newest first, in snake_case, privately', async () => {
    seedRun('2026-01-01T12:00:00.000Z');
    const response = await list();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
    const body = (await response.json()) as { items: unknown[] };
    expect(body.items).toEqual([
      {
        id: 's1',
        kind: 'scheduled',
        ran_at: '2026-01-01T12:00:00.000Z',
        sha: 'def5678',
        passed: 9,
        warned: 2,
        failed: 1,
        skipped: 0,
        openable: true,
      },
      {
        id: REPORT,
        kind: 'manual',
        ran_at: '2026-01-01T10:00:00.000Z',
        sha: 'abc1234',
        passed: 5,
        warned: 1,
        failed: 0,
        skipped: 0,
        openable: true,
      },
    ]);
  });

  it('pages with a cursor and ends with no next link', async () => {
    seedRun('2026-01-01T12:00:00.000Z');
    seedRun('2026-01-01T11:00:00.000Z');
    const firstPage = await list('?limit=2');
    const first = (await firstPage.json()) as {
      items: { id: string }[];
      next?: string;
    };
    expect(first.items.map((r) => r.id)).toEqual(['s1', 's2']);
    expect(first.next).toEqual(expect.any(String));
    const secondPage = await list(new URL(first.next ?? '').search);
    const second = (await secondPage.json()) as { items: { id: string }[] };
    expect(second.items.map((r) => r.id)).toEqual([REPORT]);
    expect(second).not.toHaveProperty('next');
  });

  it('answers 400 for a cursor it did not hand out and a limit out of range', async () => {
    const badCursor = await list('?cursor=nope');
    expect(badCursor.status).toBe(400);
    const badLimit = await list('?limit=0');
    expect(badLimit.status).toBe(400);
  });

  it('answers 404 for a domain that is not the caller’s or not an id, 401 without a session', async () => {
    const otherDomain = await list('', '00000000-0000-4000-8000-000000000002');
    expect(otherDomain.status).toBe(404);
    const notAnId = await list('', 'nope');
    expect(notAnId.status).toBe(404);
    session.uid = 8;
    const otherPerson = await list();
    expect(otherPerson.status).toBe(404);
    session.uid = null;
    const refused = await list();
    expect(refused.status).toBe(401);
    expect(refused.headers.get('content-type')).toBe(
      'application/problem+json',
    );
  });
});

describe('GET /api/domains/{id}/runs/{run_id}', () => {
  it('reads a manual run with every outcome named', async () => {
    const response = await read(REPORT);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: REPORT,
      kind: 'manual',
      url: 'https://example.com/',
      outcomes: [
        { id: 'accept-ch', name: expect.any(String), status: 'passed' },
      ],
    });
  });

  it('reads a server run by its s id', async () => {
    seedRun('2026-01-01T12:00:00.000Z');
    const response = await read('s1');
    expect(await response.json()).toMatchObject({
      id: 's1',
      kind: 'scheduled',
      sha: 'def5678',
      url: 'https://example.com/',
    });
  });

  it('answers 404 for a run with no outcomes kept, one that is not there and an id that is not one', async () => {
    seedRun('2026-01-01T12:00:00.000Z', null);
    const first = await read('s1');
    expect(first.status).toBe(404);
    const second = await read('s77');
    expect(second.status).toBe(404);
    const third = await read('nope');
    expect(third.status).toBe(404);
    const otherDomain = await read(
      REPORT,
      '00000000-0000-4000-8000-000000000002',
    );
    expect(otherDomain.status).toBe(404);
  });

  it('answers 401 without a session', async () => {
    session.uid = null;
    const response = await read(REPORT);
    expect(response.status).toBe(401);
  });
});
