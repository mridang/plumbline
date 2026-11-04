import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
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
    params: Promise.resolve({ id, report_id: reportId }),
  });

const good = {
  url: 'https://example.com/',
  outcomes: [{ id: 'accept-ch', status: 'failed', findings: [] }],
};

describe('GET /api/domains/{id}/reports', () => {
  it('lists the reports newest first', async () => {
    seedReport('r-old', 7, '2026-01-01');
    seedReport('r-new', 7, '2026-01-02');
    const body = (await (await list()).json()) as { items: { id: string }[] };
    expect(body.items.map((r) => r.id)).toEqual(['r-new', 'r-old']);
  });

  it('leaves the outcomes out', async () => {
    seedReport('r1', 7, '2026-01-01');
    const body = (await (await list()).json()) as { items: object[] };
    expect(body.items[0]).not.toHaveProperty('outcomes');
  });

  it('hands out a link to the next page', async () => {
    seedReport('r-old', 7, '2026-01-01');
    seedReport('r-new', 7, '2026-01-02');
    const first = (await (await list('?limit=1')).json()) as { next: string };
    const second = (await (await list(new URL(first.next).search)).json()) as {
      items: { id: string }[];
    };
    expect(second.items.map((r) => r.id)).toEqual(['r-old']);
  });

  it('hands out no next link on the last page', async () => {
    seedReport('r1', 7, '2026-01-01');
    const body = (await (await list('?limit=1')).json()) as object;
    expect(body).not.toHaveProperty('next');
  });

  it('answers 400 for a cursor it did not hand out', async () => {
    expect((await list('?cursor=nope')).status).toBe(400);
  });

  it('answers 400 for a limit out of range', async () => {
    expect((await list('?limit=1000')).status).toBe(400);
  });

  it('answers 404 for another person’s domain', async () => {
    session.uid = 8;
    expect((await list()).status).toBe(404);
  });

  it('answers 404 for an id that cannot be a domain', async () => {
    expect((await list('', 'nope')).status).toBe(404);
  });

  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    expect((await list()).status).toBe(401);
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
    const body = (await (await post(good)).json()) as { failed: number };
    expect(body.failed).toBe(1);
  });

  it('names each check in the answer', async () => {
    const body = (await (await post(good)).json()) as {
      outcomes: { name: string }[];
    };
    expect(typeof body.outcomes[0]?.name).toBe('string');
  });

  it('keeps the report', async () => {
    const body = (await (await post(good)).json()) as { id: string };
    expect((await read(body.id)).status).toBe(200);
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
    expect((await post('"text"')).status).toBe(400);
  });

  it('answers 413 for a report over the size limit', async () => {
    const huge = { ...good, padding: 'x'.repeat(MAX_REPORT_BYTES) };
    expect((await post(huge)).status).toBe(413);
  });

  it('answers 404 for another person’s domain', async () => {
    session.uid = 8;
    expect((await post(good)).status).toBe(404);
  });

  it('answers 403 for a write from another site', async () => {
    expect(
      (await post(good, DOMAIN, { 'sec-fetch-site': 'cross-site' })).status,
    ).toBe(403);
  });

  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    expect((await post(good)).status).toBe(401);
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
    expect((await read(REPORT)).headers.get('cache-control')).toBe(
      'private, no-cache',
    );
  });

  it('answers 404 for another person’s report', async () => {
    seedReport(REPORT, 8, '2026-01-01');
    expect((await read(REPORT)).status).toBe(404);
  });

  it('answers 404 for an id that cannot be a report', async () => {
    expect((await read('latest')).status).toBe(404);
  });

  it('answers 404 for a domain id that cannot be one', async () => {
    seedReport(REPORT, 7, '2026-01-01');
    expect((await read(REPORT, 'nope')).status).toBe(404);
  });

  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    expect((await read(REPORT)).status).toBe(401);
  });
});
