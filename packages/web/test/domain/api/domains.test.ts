import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import type { CurrentUserResolver } from '@/domain/api/auth';
import {
  createDomainItem,
  createDomainsCollection,
  domainPath,
} from '@/domain/api/domains';
import { MAX_DOMAINS } from '@/domain/db/domains';
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

/** A JSON request to the collection. */
const post = (body: unknown, headers: Record<string, string> = {}) =>
  collection.POST(
    new Request(`${ORIGIN}/api/domains`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

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
    const body = (await (await list()).json()) as {
      items: { host: string }[];
    };
    expect(body.items.map((d) => d.host)).toEqual(['a.example', 'b.example']);
  });

  it('shows nobody else’s domains', async () => {
    seed(ID, 8, 'a.example');
    const body = (await (await list()).json()) as { items: unknown[] };
    expect(body.items).toEqual([]);
  });

  it('is private to the person', async () => {
    expect((await list()).headers.get('cache-control')).toBe(
      'private, no-cache',
    );
  });

  it('hands out a link to the next page', async () => {
    seed(ID, 7, 'a.example', '2026-01-01');
    seed(OTHER, 7, 'b.example', '2026-01-02');
    const first = (await (await list('?limit=1')).json()) as {
      next: string;
    };
    const second = (await (await list(new URL(first.next).search)).json()) as {
      items: { host: string }[];
    };
    expect(second.items.map((d) => d.host)).toEqual(['b.example']);
  });

  it('answers 400 for a limit out of range', async () => {
    expect((await list('?limit=0')).status).toBe(400);
  });

  it('answers 400 for a cursor it did not hand out', async () => {
    expect((await list('?cursor=nope')).status).toBe(400);
  });

  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    expect((await list()).status).toBe(401);
  });
});

describe('POST /api/domains', () => {
  it('adds the domain with 201 and its address', async () => {
    const res = await post({ host: 'Example.com' });
    const body = (await res.json()) as { id: string; host: string };
    expect([res.status, body.host, res.headers.get('location')]).toEqual([
      201,
      'example.com',
      `${ORIGIN}/api/domains/${body.id}`,
    ]);
  });

  it('runs every check on a new domain', async () => {
    const body = (await (await post({ host: 'example.com' })).json()) as {
      all_checks: boolean;
    };
    expect(body.all_checks).toBe(true);
  });

  it('answers 200 with the domain the person already has for that host', async () => {
    seed(ID, 7, 'example.com');
    const res = await post({ host: 'https://example.com/page' });
    expect([res.status, res.headers.get('location')]).toEqual([
      200,
      `${ORIGIN}/api/domains/${ID}`,
    ]);
  });

  it('answers 400 with the reason for a host that is not a domain', async () => {
    const res = await post({ host: '10.0.0.1' });
    const body = (await res.json()) as { errors: string[] };
    expect([res.status, body.errors]).toEqual([
      400,
      ['host: Enter a domain name, not an IP address.'],
    ]);
  });

  it('answers 400 for a body that is not an object', async () => {
    expect((await post('[1]')).status).toBe(400);
  });

  it('answers 415 for a body that is not JSON', async () => {
    expect(
      (await post('host=example.com', { 'content-type': 'text/plain' })).status,
    ).toBe(415);
  });

  it(`answers 409 once the person keeps ${MAX_DOMAINS} domains`, async () => {
    for (let n = 0; n < MAX_DOMAINS; n += 1) {
      seed(`id-${n}`, 7, `d${n}.example`);
    }
    const res = await post({ host: 'one-more.example' });
    const body = (await res.json()) as { type: string };
    expect([res.status, body.type]).toEqual([
      409,
      '/problems/too-many-domains',
    ]);
  });

  it('still answers the domain the person has when they are at the limit', async () => {
    for (let n = 0; n < MAX_DOMAINS; n += 1) {
      seed(`id-${n}`, 7, `d${n}.example`);
    }
    expect((await post({ host: 'd3.example' })).status).toBe(200);
  });

  it('answers 403 for a write from another site', async () => {
    expect(
      (await post({ host: 'example.com' }, { 'sec-fetch-site': 'cross-site' }))
        .status,
    ).toBe(403);
  });

  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    expect((await post({ host: 'example.com' })).status).toBe(401);
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
    expect((await call('GET', ID)).status).toBe(404);
  });

  it('answers 404 for an id that cannot be a domain', async () => {
    expect((await call('GET', 'nope')).status).toBe(404);
  });

  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    expect((await call('GET', ID)).status).toBe(401);
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
    const body = (await (await call('GET', ID)).json()) as {
      checks: string[];
    };
    expect(body.checks).toEqual(['accept-ch']);
  });

  it('goes back to every check for null', async () => {
    await patch(ID, { checks: ['accept-ch'] });
    const body = (await (await patch(ID, { checks: null })).json()) as {
      all_checks: boolean;
    };
    expect(body.all_checks).toBe(true);
  });

  it('honours an If-Match that still matches', async () => {
    const etag = (await call('GET', ID)).headers.get('etag') ?? '';
    expect(
      (await patch(ID, { checks: null }, { 'if-match': etag })).status,
    ).toBe(200);
  });

  it('answers 412 for an If-Match that no longer matches', async () => {
    expect(
      (await patch(ID, { checks: null }, { 'if-match': '"stale"' })).status,
    ).toBe(412);
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
    expect((await patch(ID, { host: 'other.example' })).status).toBe(400);
  });

  it('answers 404 for another person’s domain', async () => {
    seed(OTHER, 8, 'example.com');
    expect((await patch(OTHER, { checks: null })).status).toBe(404);
  });

  it('answers 403 for a write from another site', async () => {
    expect(
      (await patch(ID, { checks: null }, { 'sec-fetch-site': 'cross-site' }))
        .status,
    ).toBe(403);
  });
});

describe('DELETE /api/domains/{id}', () => {
  beforeEach(() => {
    seed(ID, 7, 'example.com');
    raw
      .prepare(
        "INSERT INTO reports (id, domain_id, user_id, url, passed, warned, failed, skipped, outcomes, created_at) VALUES ('r1', ?, 7, 'https://example.com/', 0, 0, 0, 0, '[]', 'now')",
      )
      .run(ID);
  });

  it('answers 204', async () => {
    expect((await call('DELETE', ID)).status).toBe(204);
  });

  it('removes the domain', async () => {
    await call('DELETE', ID);
    expect((await call('GET', ID)).status).toBe(404);
  });

  it('removes the domain’s reports', async () => {
    await call('DELETE', ID);
    expect(raw.prepare('SELECT id FROM reports').all()).toEqual([]);
  });

  it('answers 404 for another person’s domain', async () => {
    session.uid = 8;
    expect((await call('DELETE', ID)).status).toBe(404);
  });

  it('answers 404 for an id that cannot be a domain', async () => {
    expect((await call('DELETE', 'nope')).status).toBe(404);
  });
});
