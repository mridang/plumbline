import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../lib/core/db/sqlite-d1';

const session: { uid: number | null } = { uid: 7 };

jest.unstable_mockModule('@/domain/api/auth', () => ({
  requireLiveUid: async () =>
    session.uid === null
      ? { ok: false, response: new Response(null, { status: 401 }) }
      : { ok: true, value: session.uid },
}));

const { GET } = await import('@/app/events/route');

let restore: () => void;
const asked: { name: string; resume: string | null }[] = [];

beforeEach(() => {
  session.uid = 7;
  asked.length = 0;
  const USER_HUB = {
    idFromName: (name: string) => name,
    get: (name: string) => ({
      fetch: async (_url: string, init?: RequestInit) => {
        asked.push({
          name,
          resume: new Headers(init?.headers).get('last-event-id'),
        });
        return new Response('data', {
          headers: { 'content-type': 'text/event-stream' },
        });
      },
    }),
  };
  restore = installCloudflareContext(sqliteD1(...APP_MIGRATIONS).d1, {
    USER_HUB,
  });
});
afterEach(() => restore());

describe('GET /events', () => {
  it('opens the stream of the signed-in person, and no one else’s', async () => {
    const response = await GET(new Request('https://plumbline.test/events'));
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(asked).toEqual([{ name: '7', resume: null }]);
  });

  it('resumes after the position the browser last saw', async () => {
    await GET(
      new Request('https://plumbline.test/events', {
        headers: { 'last-event-id': '41' },
      }),
    );
    expect(asked[0]?.resume).toBe('41');
  });

  it('opens nothing without a session', async () => {
    session.uid = null;
    const response = await GET(new Request('https://plumbline.test/events'));
    expect(response.status).toBe(401);
    expect(asked).toEqual([]);
  });
});
