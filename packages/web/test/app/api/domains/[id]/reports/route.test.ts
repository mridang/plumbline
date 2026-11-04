import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { GET, POST, dynamic } from '@/app/api/domains/[id]/reports/route';
import { SESSION_COOKIE } from '@/domain/auth/app';
import { APP_MIGRATIONS } from '../../../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../../../lib/core/db/sqlite-d1';
import {
  SESSION_SECRET,
  tokenFor,
} from '../../../../../domain/auth/auth-test-kit';

const ID = '00000000-0000-4000-8000-000000000001';
const URL = `https://plumbline.test/api/domains/${ID}/reports`;
const params = { params: Promise.resolve({ id: ID }) };

let restore: () => void;
/** The Cookie header of the signed-in caller. */
let cookie: string;

beforeEach(async () => {
  const made = sqliteD1(...APP_MIGRATIONS);
  restore = installCloudflareContext(made.d1, { SESSION_SECRET });
  made.raw
    .prepare(
      "INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (7, 'g7', 'a@b.com', 'now', 'now')",
    )
    .run();
  made.raw
    .prepare(
      "INSERT INTO domains (id, user_id, host, created_at, updated_at) VALUES (?, 7, 'example.com', 'now', 'now')",
    )
    .run(ID);
  cookie = `${SESSION_COOKIE}=${await tokenFor({ id: 7 }, { ep: 0 })}`;
});

afterEach(() => restore());

/** A POST of one scan's outcome. */
const save = (headers: Record<string, string>) =>
  POST(
    new Request(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({
        url: 'https://example.com/',
        outcomes: [{ id: 'accept-ch', status: 'passed' }],
      }),
    }),
    params,
  );

describe('/api/domains/:id/reports', () => {
  it('is never prerendered', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('saves a report for the person the session cookie names', async () => {
    expect((await save({ cookie })).status).toBe(201);
  });

  it('lists the saved reports', async () => {
    await save({ cookie });
    const body = (await (
      await GET(new Request(URL, { headers: { cookie } }), params)
    ).json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });

  it('answers 401 to a GET without a session cookie', async () => {
    expect((await GET(new Request(URL), params)).status).toBe(401);
  });

  it('answers 401 to a POST without a session cookie', async () => {
    expect((await save({})).status).toBe(401);
  });
});
