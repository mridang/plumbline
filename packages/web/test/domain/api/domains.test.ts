import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- experimental API used on purpose
import type { DatabaseSync } from 'node:sqlite';

import type { CurrentUserResolver } from '@/domain/api/auth';
import {
  createDomainItem,
  createDomainsCollection,
  domainPath,
} from '@/domain/api/domains';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../lib/core/db/sqlite-d1';

/** Who is signed in; null means nobody (or a session that has been ended). */
const session: { uid: number | null } = { uid: 7 };

/** Identity injected in place of the session cookie. */
const resolver: CurrentUserResolver = {
  currentUid: async () => session.uid,
  currentLiveUid: async () => session.uid,
  currentUser: async () => null,
};

const collection = createDomainsCollection(resolver).handlers();
const item = createDomainItem(resolver).handlers();

const ORIGIN = 'https://plumbline.test';
const ID = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';

let raw: DatabaseSync;
let restore: () => void;

/** Store a domain for `uid` directly. */
function seed(id: string, uid: number, host: string, created = '2026-01-01') {
  raw
    .prepare(
      'INSERT INTO domains (id, user_id, host, checks, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
    )
    .run(id, uid, host, created, created);
}

beforeEach(() => {
  session.uid = 7;
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
});

afterEach(() => restore());

/** A GET of the collection with the given query. */
const list = (query = '') =>
  collection.GET(new Request(`${ORIGIN}/api/domains${query}`));

/** A request to one domain. */
const call = (
  method: 'GET' | 'PATCH' | 'DELETE',
  id: string,
  init: RequestInit = {},
) =>
  item[method](new Request(`${ORIGIN}${domainPath(id)}`, { method, ...init }), {
    params: Promise.resolve({ id }),
  });

/** A merge patch of one domain. */
const patch = (
  id: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  call('PATCH', id, {
    headers: { 'content-type': 'application/merge-patch+json', ...headers },
    body: JSON.stringify(body),
  });

describe('GET /api/domains', () => {
  it('lists the person’s domains, oldest first', async () => {
    seed(OTHER, 7, 'b.example', '2026-01-02');
    seed(ID, 7, 'a.example', '2026-01-01');
    const res = await list();
    const body = (await res.json()) as {
      items: { host: string }[];
    };
    expect(body.items.map((d) => d.host)).toEqual(['a.example', 'b.example']);
  });

  it('shows nobody else’s domains', async () => {
    seed(ID, 8, 'a.example');
    const res = await list();
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toEqual([]);
  });

  it('is private to the person', async () => {
    const res = await list();
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
  });

  it('hands out a link to the next page', async () => {
    seed(ID, 7, 'a.example', '2026-01-01');
    seed(OTHER, 7, 'b.example', '2026-01-02');
    const firstPage = await list('?limit=1');
    const first = (await firstPage.json()) as {
      next: string;
    };
    const nextPage = await list(new URL(first.next).search);
    const second = (await nextPage.json()) as {
      items: { host: string }[];
    };
    expect(second.items.map((d) => d.host)).toEqual(['b.example']);
  });

  it('answers 400 for a limit out of range', async () => {
    const res = await list('?limit=0');
    expect(res.status).toBe(400);
  });

  it('answers 400 for a cursor it did not hand out', async () => {
    const res = await list('?cursor=nope');
    expect(res.status).toBe(400);
  });

  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    const res = await list();
    expect(res.status).toBe(401);
  });
});

describe('GET /api/domains/{id}', () => {
  it('answers the domain with an entity tag', async () => {
    seed(ID, 7, 'example.com');
    const res = await call('GET', ID);
    const body = (await res.json()) as { host: string };
    expect([res.status, body.host, res.headers.get('etag')]).toEqual([
      200,
      'example.com',
      expect.stringMatching(/^"/),
    ]);
  });

  it('answers 404 for another person’s domain', async () => {
    seed(ID, 8, 'example.com');
    const res = await call('GET', ID);
    expect(res.status).toBe(404);
  });

  it('answers 404 for an id that cannot be a domain', async () => {
    const res = await call('GET', 'nope');
    expect(res.status).toBe(404);
  });

  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    const res = await call('GET', ID);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/domains/{id}', () => {
  beforeEach(() => seed(ID, 7, 'example.com'));

  it('chooses the checks that run', async () => {
    const res = await patch(ID, { checks: ['accept-ch'] });
    const body = (await res.json()) as {
      checks: string[];
      all_checks: boolean;
    };
    expect([res.status, body.checks, body.all_checks]).toEqual([
      200,
      ['accept-ch'],
      false,
    ]);
  });

  it('keeps the choice', async () => {
    await patch(ID, { checks: ['accept-ch'] });
    const res = await call('GET', ID);
    const body = (await res.json()) as {
      checks: string[];
    };
    expect(body.checks).toEqual(['accept-ch']);
  });

  it('goes back to every check for null', async () => {
    await patch(ID, { checks: ['accept-ch'] });
    const res = await patch(ID, { checks: null });
    const body = (await res.json()) as {
      all_checks: boolean;
    };
    expect(body.all_checks).toBe(true);
  });

  it('honours an If-Match that still matches', async () => {
    const current = await call('GET', ID);
    const etag = current.headers.get('etag') ?? '';
    const res = await patch(ID, { checks: null }, { 'if-match': etag });
    expect(res.status).toBe(200);
  });

  it('answers 412 for an If-Match that no longer matches', async () => {
    const res = await patch(ID, { checks: null }, { 'if-match': '"stale"' });
    expect(res.status).toBe(412);
  });

  it('answers 400 for checks that do not exist', async () => {
    const res = await patch(ID, { checks: ['nope'] });
    const body = (await res.json()) as { errors: string[] };
    expect([res.status, body.errors]).toEqual([
      400,
      ['checks: "nope" is not a check or a group.'],
    ]);
  });

  it('answers 400 for a change to the host', async () => {
    const res = await patch(ID, { host: 'other.example' });
    expect(res.status).toBe(400);
  });

  it('answers 404 for another person’s domain', async () => {
    seed(OTHER, 8, 'example.com');
    const res = await patch(OTHER, { checks: null });
    expect(res.status).toBe(404);
  });

  it('answers 403 for a write from another site', async () => {
    const res = await patch(
      ID,
      { checks: null },
      { 'sec-fetch-site': 'cross-site' },
    );
    expect(res.status).toBe(403);
  });
});
