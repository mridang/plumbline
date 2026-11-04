import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { GET, dynamic } from '@/app/api/domains/[id]/reports/[report_id]/route';
import { SESSION_COOKIE } from '@/domain/auth/app';
import { APP_MIGRATIONS } from '../../../../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../../../../lib/core/db/sqlite-d1';
import {
  SESSION_SECRET,
  tokenFor,
} from '../../../../../../domain/auth/auth-test-kit';

const ID = '00000000-0000-4000-8000-000000000001';
const REPORT = '00000000-0000-4000-8000-0000000000aa';
const URL = `https://plumbline.test/api/domains/${ID}/reports/${REPORT}`;
const params = { params: Promise.resolve({ id: ID, report_id: REPORT }) };

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
      "INSERT INTO reports (id, domain_id, user_id, url, passed, warned, failed, skipped, outcomes, created_at) VALUES (?, ?, 7, 'https://example.com/', 0, 0, 0, 0, '[]', 'now')",
    )
    .run(REPORT, ID);
  cookie = `${SESSION_COOKIE}=${await tokenFor({ id: 7 }, { ep: 0 })}`;
});

afterEach(() => restore());

describe('/api/domains/:id/reports/:report_id', () => {
  it('is never prerendered', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('reads the report of the person the session cookie names', async () => {
    const body = (await (
      await GET(new Request(URL, { headers: { cookie } }), params)
    ).json()) as { id: string };
    expect(body.id).toBe(REPORT);
  });

  it('answers 401 without a session cookie', async () => {
    expect((await GET(new Request(URL), params)).status).toBe(401);
  });
});
