import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { GET, dynamic } from '@/app/api/domains/route';
import { SESSION_COOKIE } from '@/domain/auth/app';
import { APP_MIGRATIONS } from '../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../lib/core/db/sqlite-d1';
import { SESSION_SECRET, tokenFor } from '../../../domain/auth/auth-test-kit';

const URL = 'https://plumbline.test/api/domains';

let restore: () => void;
let made: ReturnType<typeof sqliteD1>;
/** The Cookie header of the signed-in caller. */
let cookie: string;

beforeEach(async () => {
  made = sqliteD1(...APP_MIGRATIONS);
  restore = installCloudflareContext(made.d1, { SESSION_SECRET });
  made.raw
    .prepare(
      "INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (7, 'g7', 'a@b.com', 'now', 'now')",
    )
    .run();
  cookie = `${SESSION_COOKIE}=${await tokenFor({ id: 7 }, { ep: 0 })}`;
});

afterEach(() => restore());

describe('/api/domains', () => {
  it('is never prerendered', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('lists the domains of the person the session cookie names', async () => {
    made.raw
      .prepare(
        "INSERT INTO domains (id, user_id, host, created_at, updated_at) VALUES ('00000000-0000-4000-8000-000000000009', 7, 'example.com', 'now', 'now')",
      )
      .run();
    const res = await GET(new Request(URL, { headers: { cookie } }));
    const body = (await res.json()) as { items: { host: string }[] };
    expect(body.items.map((d) => d.host)).toEqual(['example.com']);
  });

  it('answers 401 to a GET without a session cookie', async () => {
    const res = await GET(new Request(URL));
    expect(res.status).toBe(401);
  });
});
