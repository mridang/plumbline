import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { GET, PATCH, dynamic } from '@/app/api/domains/[id]/route';
import { SESSION_COOKIE } from '@/domain/auth/app';
import { APP_MIGRATIONS } from '../../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../../lib/core/db/sqlite-d1';
import {
  SESSION_SECRET,
  tokenFor,
} from '../../../../domain/auth/auth-test-kit';

const ID = '00000000-0000-4000-8000-000000000001';
const URL = `https://plumbline.test/api/domains/${ID}`;
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

/** A PATCH of the domain's checks. */
const patch = (headers: Record<string, string>) =>
  PATCH(
    new Request(URL, {
      method: 'PATCH',
      headers: { 'content-type': 'application/merge-patch+json', ...headers },
      body: JSON.stringify({ checks: ['accept-ch'] }),
    }),
    params,
  );

describe('/api/domains/:id', () => {
  it('is never prerendered', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('reads the domain of the person the session cookie names', async () => {
    const res = await GET(new Request(URL, { headers: { cookie } }), params);
    expect(res.status).toBe(200);
  });

  it('chooses the checks of the domain', async () => {
    const res = await patch({ cookie });
    const body = (await res.json()) as {
      checks: string[];
    };
    expect(body.checks).toEqual(['accept-ch']);
  });

  it('answers 401 to a GET without a session cookie', async () => {
    const res = await GET(new Request(URL), params);
    expect(res.status).toBe(401);
  });

  it('answers 401 to a PATCH without a session cookie', async () => {
    const res = await patch({});
    expect(res.status).toBe(401);
  });
});
