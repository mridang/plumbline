import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { addDomain } from '@/domain/db/domains';
import { createDatabase } from '@/domain/db/client';

import { APP_MIGRATIONS } from '../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../lib/core/db/sqlite-d1';

const session: { uid: number | null } = { uid: 7 };

jest.unstable_mockModule('@/domain/api/auth', () => ({
  requireLiveUid: async () =>
    session.uid === null
      ? { ok: false, response: new Response(null, { status: 401 }) }
      : { ok: true, value: session.uid },
}));

const { GET } = await import('@/app/api/overview/route');

let restore: () => void;
let db: ReturnType<typeof createDatabase>;

beforeEach(() => {
  session.uid = 7;
  const made = sqliteD1(...APP_MIGRATIONS);
  db = createDatabase(made.d1);
  restore = installCloudflareContext(made.d1);
});
afterEach(() => restore());

describe('GET /api/overview', () => {
  it('lists the person’s sites by repository, and never caches it', async () => {
    await addDomain(db, 7, 'a.test', 'acme/site');
    await addDomain(db, 8, 'theirs.test', 'acme/other');
    const response = await GET(
      new Request('https://plumbline.test/api/overview'),
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const body = (await response.json()) as {
      repos: { repo: string; sites: { host: string }[] }[];
    };
    expect(body.repos.map((r) => r.repo)).toEqual(['acme/site']);
    expect(body.repos[0]?.sites[0]?.host).toBe('a.test');
  });

  it('refuses nobody signed in', async () => {
    session.uid = null;
    const response = await GET(
      new Request('https://plumbline.test/api/overview'),
    );
    expect(response.status).toBe(401);
  });
});
