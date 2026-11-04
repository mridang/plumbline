import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { GET, POST, dynamic } from '@/app/api/domains/route';
import { SESSION_COOKIE } from '@/domain/auth/app';
import { APP_MIGRATIONS } from '../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../lib/core/db/sqlite-d1';
import { SESSION_SECRET, tokenFor } from '../../../domain/auth/auth-test-kit';

const URL = 'https://plumbline.test/api/domains';

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
  cookie = `${SESSION_COOKIE}=${await tokenFor({ id: 7 }, { ep: 0 })}`;
});

afterEach(() => restore());

/** A POST adding `host`, with the given headers. */
const add = (host: string, headers: Record<string, string>) =>
  POST(
    new Request(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ host }),
    }),
  );

describe('/api/domains', () => {
  it('is never prerendered', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('adds a domain for the person the session cookie names', async () => {
    expect((await add('example.com', { cookie })).status).toBe(201);
  });

  it('lists the domains of the person the session cookie names', async () => {
    await add('example.com', { cookie });
    const body = (await (
      await GET(new Request(URL, { headers: { cookie } }))
    ).json()) as { items: { host: string }[] };
    expect(body.items.map((d) => d.host)).toEqual(['example.com']);
  });

  it('answers 401 to a GET without a session cookie', async () => {
    expect((await GET(new Request(URL))).status).toBe(401);
  });

  it('answers 401 to a POST without a session cookie', async () => {
    expect((await add('example.com', {})).status).toBe(401);
  });
});
