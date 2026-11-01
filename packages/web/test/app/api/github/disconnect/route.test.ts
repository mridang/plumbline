import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { getLink, linkAccount } from '@/domain/db/github';
import { APP_MIGRATIONS } from '../../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../../lib/core/db/sqlite-d1';

const state: { user: { id: number } | null } = { user: { id: 7 } };
jest.unstable_mockModule('@/lib/core/auth/current-user', () => ({
  getCurrentUser: async () => state.user,
}));

const { POST } = await import('@/app/api/github/disconnect/route');

let restore: () => void;
let made: ReturnType<typeof sqliteD1>;

beforeEach(() => {
  state.user = { id: 7 };
  made = sqliteD1(...APP_MIGRATIONS);
  restore = installCloudflareContext(made.d1);
});

afterEach(() => restore());

const post = (headers: Record<string, string> = {}) =>
  POST(
    new Request('https://plumbline.test/api/github/disconnect', {
      method: 'POST',
      headers,
    }),
  );

describe('POST /api/github/disconnect', () => {
  it("forgets the person's GitHub account and answers 204", async () => {
    const db = createDatabase(made.d1);
    await linkAccount(db, 7, { id: 9, login: 'mridang' });
    expect((await post()).status).toBe(204);
    expect(await getLink(db, 7)).toBeUndefined();
  });

  it('refuses a request from another site and someone not signed in', async () => {
    const db = createDatabase(made.d1);
    await linkAccount(db, 7, { id: 9, login: 'mridang' });
    expect((await post({ 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    state.user = null;
    expect((await post()).status).toBe(401);
    expect(await getLink(db, 7)).toBeDefined();
  });
});
