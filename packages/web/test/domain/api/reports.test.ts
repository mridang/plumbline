import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- experimental API used on purpose
import type { DatabaseSync } from 'node:sqlite';

import type { CurrentUserResolver } from '@/domain/api/auth';
import { MAX_REPORT_BYTES } from '@/domain/api/report-resource';
import {
  createReportItem,
  createReportsCollection,
  reportPath,
} from '@/domain/api/reports';
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

const collection = createReportsCollection(resolver).handlers();
const item = createReportItem(resolver).handlers();

const ORIGIN = 'https://plumbline.test';
const DOMAIN = '00000000-0000-4000-8000-000000000001';
const REPORT = '00000000-0000-4000-8000-0000000000aa';

let raw: DatabaseSync;
let restore: () => void;

/** Store a report of the domain directly. */
function seedReport(id: string, uid: number, created: string) {
  raw
    .prepare(
      "INSERT INTO reports (id, domain_id, user_id, url, passed, warned, failed, skipped, outcomes, created_at) VALUES (?, ?, ?, 'https://example.com/', 1, 0, 0, 0, ?, ?)",
    )
    .run(
      id,
      DOMAIN,
      uid,
      JSON.stringify([{ id: 'accept-ch', status: 'passed', findings: [] }]),
      created,
    );
}

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
});

afterEach(() => restore());

const params = (id = DOMAIN) => ({ params: Promise.resolve({ id }) });

/** A GET of the domain's reports with the given query. */
const list = (query = '', id = DOMAIN) =>
  collection.GET(
    new Request(`${ORIGIN}/api/domains/${id}/reports${query}`),
    params(id),
  );

/** A POST of a report body. */
const post = (
  body: unknown,
  id = DOMAIN,
  headers: Record<string, string> = {},
) =>
  collection.POST(
    new Request(`${ORIGIN}/api/domains/${id}/reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    params(id),
  );

/** A GET of one report. */
const read = (reportId: string, id = DOMAIN) =>
  item.GET(new Request(`${ORIGIN}${reportPath(id, reportId)}`), {
    params: Promise.resolve({ id, 'report-id': reportId }),
  });

const good = {
  url: 'https://example.com/',
  outcomes: [{ id: 'accept-ch', status: 'failed', findings: [] }],
};

describe('GET /api/domains/{id}/reports', () => {
  it('lists the reports newest first', async () => {
    seedReport('r-old', 7, '2026-01-01');
    seedReport('r-new', 7, '2026-01-02');
    const response = await list();
    const body = (await response.json()) as { items: { id: string }[] };
    expect(body.items.map((r) => r.id)).toEqual(['r-new', 'r-old']);
  });

  it('leaves the outcomes out', async () => {
    seedReport('r1', 7, '2026-01-01');
    const response = await list();
    const body = (await response.json()) as { items: object[] };
    expect(body.items[0]).not.toHaveProperty('outcomes');
  });

  it('hands out a link to the next page', async () => {
    seedReport('r-old', 7, '2026-01-01');
    seedReport('r-new', 7, '2026-01-02');
    const firstPage = await list('?limit=1');
    const first = (await firstPage.json()) as { next: string };
    const secondPage = await list(new URL(first.next).search);
    const second = (await secondPage.json()) as {
      items: { id: string }[];
    };
    expect(second.items.map((r) => r.id)).toEqual(['r-old']);
  });

  it('hands out no next link on the last page', async () => {
    seedReport('r1', 7, '2026-01-01');
    const response = await list('?limit=1');
    const body = (await response.json()) as object;
    expect(body).not.toHaveProperty('next');
  });

  it('answers 400 for a cursor it did not hand out', async () => {
    const response = await list('?cursor=nope');
    expect(response.status).toBe(400);
  });

  it('answers 400 for a limit out of range', async () => {
    const response = await list('?limit=1000');
    expect(response.status).toBe(400);
  });

  it('answers 404 for another person’s domain', async () => {
    session.uid = 8;
    const response = await list();
    expect(response.status).toBe(404);
  });

  it('answers 404 for an id that cannot be a domain', async () => {
    const response = await list('', 'nope');
    expect(response.status).toBe(404);
  });

  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    const response = await list();
    expect(response.status).toBe(401);
  });
});

describe('POST /api/domains/{id}/reports and the five-minute limit', () => {
  it('refuses a second report within five minutes with 429 and when to try again', async () => {
    const created = await post(good);
    expect(created.status).toBe(201);
    const refused = await post(good);
    expect(refused.status).toBe(429);
    expect(refused.headers.get('content-type')).toBe(
      'application/problem+json',
    );
    const wait = Number(refused.headers.get('retry-after'));
    expect(wait).toBeGreaterThan(290);
    expect(wait).toBeLessThanOrEqual(300);
    expect(((await refused.json()) as { detail: string }).detail).toContain(
      'try again in',
    );
  });

  it('allows another report once five minutes have passed, and keeps only the refused one out', async () => {
    seedReport('r-old', 7, new Date(Date.now() - 301_000).toISOString());
    const created = await post(good);
    expect(created.status).toBe(201);
    const refused = await post(good);
    expect(refused.status).toBe(429);
    const listed = await list();
    const body = (await listed.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(2);
  });

  it('counts each domain on its own', async () => {
    const other = '00000000-0000-4000-8000-000000000002';
    raw
      .prepare(
        "INSERT INTO domains (id, user_id, host, created_at, updated_at) VALUES (?, 7, 'other.com', 'now', 'now')",
      )
      .run(other);
    const first = await post(good);
    expect(first.status).toBe(201);
    const second = await post({ ...good, url: 'https://other.com/' }, other);
    expect(second.status).toBe(201);
  });

  it('records the commit the site was last known to be at', async () => {
    raw
      .prepare(
        "INSERT INTO suite_runs (user_id, host, repo, sha, status, ran_at, findings) VALUES (7, 'example.com', 'a/b', 'cafe123', 200, 'now', '[]')",
      )
      .run();
    const response = await post(good);
    expect(response.status).toBe(201);
    expect(raw.prepare('SELECT sha FROM reports').get()).toEqual({
      sha: 'cafe123',
    });
  });

  it('records no commit when the site has had no server run', async () => {
    const response = await post(good);
    expect(response.status).toBe(201);
    expect(raw.prepare('SELECT sha FROM reports').get()).toEqual({ sha: null });
  });
});

describe('POST /api/domains/{id}/reports', () => {
  it('saves the report with 201 and its address', async () => {
    const res = await post(good);
    const body = (await res.json()) as { id: string };
    expect([res.status, res.headers.get('location')]).toEqual([
      201,
      `${ORIGIN}${reportPath(DOMAIN, body.id)}`,
    ]);
  });

  it('counts the outcomes itself', async () => {
    const response = await post(good);
    const body = (await response.json()) as { failed: number };
    expect(body.failed).toBe(1);
  });

  it('names each check in the answer', async () => {
    const response = await post(good);
    const body = (await response.json()) as {
      outcomes: { name: string }[];
    };
    expect(typeof body.outcomes[0]?.name).toBe('string');
  });

  it('keeps the report', async () => {
    const created = await post(good);
    const body = (await created.json()) as { id: string };
    const response = await read(body.id);
    expect(response.status).toBe(200);
  });

  it('answers 400 with the reasons for a report that is not well formed', async () => {
    const res = await post({ ...good, url: 'https://elsewhere.example/' });
    const body = (await res.json()) as { errors: string[] };
    expect([res.status, body.errors]).toEqual([
      400,
      ['url: must be an http or https address on example.com.'],
    ]);
  });

  it('answers 400 for a body that is not an object', async () => {
    const response = await post('"text"');
    expect(response.status).toBe(400);
  });

  it('answers 413 for a report over the size limit', async () => {
    const huge = { ...good, padding: 'x'.repeat(MAX_REPORT_BYTES) };
    const response = await post(huge);
    expect(response.status).toBe(413);
  });

  it('answers 404 for another person’s domain', async () => {
    session.uid = 8;
    const response = await post(good);
    expect(response.status).toBe(404);
  });

  it('answers 403 for a write from another site', async () => {
    const response = await post(good, DOMAIN, {
      'sec-fetch-site': 'cross-site',
    });
    expect(response.status).toBe(403);
  });

  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    const response = await post(good);
    expect(response.status).toBe(401);
  });
});

describe('GET /api/domains/{id}/reports/{report_id}', () => {
  it('answers the report with its outcomes', async () => {
    seedReport(REPORT, 7, '2026-01-01');
    const res = await read(REPORT);
    const body = (await res.json()) as { outcomes: { id: string }[] };
    expect([res.status, body.outcomes.map((o) => o.id)]).toEqual([
      200,
      ['accept-ch'],
    ]);
  });

  it('is private to the person', async () => {
    seedReport(REPORT, 7, '2026-01-01');
    const response = await read(REPORT);
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
  });

  it('answers 404 for another person’s report', async () => {
    seedReport(REPORT, 8, '2026-01-01');
    const response = await read(REPORT);
    expect(response.status).toBe(404);
  });

  it('answers 404 for an id that cannot be a report', async () => {
    const response = await read('latest');
    expect(response.status).toBe(404);
  });

  it('answers 404 for a domain id that cannot be one', async () => {
    seedReport(REPORT, 7, '2026-01-01');
    const response = await read(REPORT, 'nope');
    expect(response.status).toBe(404);
  });

  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    const response = await read(REPORT);
    expect(response.status).toBe(401);
  });
});
