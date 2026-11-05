import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import type { CurrentUserResolver } from '@/domain/api/auth';
import {
  createPushConfiguration,
  createSubscriptionItem,
  createSubscriptionTests,
  createSubscriptionsCollection,
} from '@/domain/push/controller';
import { subscriptionId } from '@/lib/push/subscription-id';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../lib/core/db/sqlite-d1';

const session: { uid: number | null } = { uid: 7 };
const resolver: CurrentUserResolver = {
  currentUid: async () => session.uid,
  currentLiveUid: async () => session.uid,
  currentUser: async () => null,
};

const ORIGIN = 'https://plumbline.test';
const ENDPOINT = 'https://push.test/abc';
const GOOD = { endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' } };

const configuration = createPushConfiguration(resolver).handlers();
const collection = createSubscriptionsCollection(resolver).handlers();
const item = createSubscriptionItem(resolver).handlers();
const tests = createSubscriptionTests(resolver).handlers();

let raw: DatabaseSync;
let restore: () => void;

/** Install a database and an environment; `vapid` turns notifications on. */
function install(vapid: boolean) {
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1, {
    VAPID_PUBLIC_KEY: 'public',
    VAPID_SUBJECT: 'mailto:a@b.test',
    ...(vapid ? { VAPID_PRIVATE_KEY: 'private' } : {}),
  });
}

beforeEach(() => {
  session.uid = 7;
  install(true);
});
afterEach(() => {
  restore();
  jest.restoreAllMocks();
});

const post = (body: unknown) =>
  collection.POST(
    new Request(`${ORIGIN}/api/users/self/push/subscriptions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

const owners = () =>
  raw.prepare('SELECT endpoint, user_id FROM push_subscriptions').all();

describe('GET /api/push/configuration', () => {
  it('gives the key a browser subscribes with, privately', async () => {
    const response = await configuration.GET(
      new Request(`${ORIGIN}/api/push/configuration`),
    );
    expect(await response.json()).toEqual({ vapid_public_key: 'public' });
    expect(response.headers.get('cache-control')).toBe('private, max-age=3600');
  });

  it('refuses nobody signed in', async () => {
    session.uid = null;
    const response = await configuration.GET(
      new Request(`${ORIGIN}/api/push/configuration`),
    );
    expect(response.status).toBe(401);
  });
});

describe('POST /api/users/self/push/subscriptions', () => {
  it('registers a subscription for the person, then answers 200 for the same one', async () => {
    const first = await post(GOOD);
    expect(first.status).toBe(201);
    const id = await subscriptionId(ENDPOINT);
    expect(first.headers.get('location')).toBe(
      `${ORIGIN}/api/users/self/push/subscriptions/${id}`,
    );
    expect((await post(GOOD)).status).toBe(200);
    expect(owners()).toEqual([{ endpoint: ENDPOINT, user_id: 7 }]);
  });

  it.each([
    [{ endpoint: 'http://push.test/x', keys: { p256dh: 'p', auth: 'a' } }],
    [{ endpoint: ENDPOINT, keys: { auth: 'a' } }],
    [{ endpoint: ENDPOINT, keys: { p256dh: 'p' } }],
    [{ keys: { p256dh: 'p', auth: 'a' } }],
  ])('refuses %j', async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(owners()).toEqual([]);
  });

  it('refuses nobody signed in', async () => {
    session.uid = null;
    expect((await post(GOOD)).status).toBe(401);
  });
});

describe('DELETE /api/users/self/push/subscriptions/{id}', () => {
  const remove = async (id: string) =>
    item.DELETE(
      new Request(`${ORIGIN}/api/users/self/push/subscriptions/${id}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id }) },
    );

  it('forgets the person’s own subscription', async () => {
    await post(GOOD);
    expect((await remove(await subscriptionId(ENDPOINT))).status).toBe(204);
    expect(owners()).toEqual([]);
  });

  it('cannot forget someone else’s, and says it is not there', async () => {
    await post(GOOD);
    session.uid = 8;
    expect((await remove(await subscriptionId(ENDPOINT))).status).toBe(404);
    expect(owners()).toHaveLength(1);
  });

  it('answers 404 for an id that is not one', async () => {
    expect((await remove('nope')).status).toBe(404);
  });
});

describe('POST /api/users/self/push/subscriptions/{id}/tests', () => {
  const test = async (id: string) =>
    tests.POST(
      new Request(`${ORIGIN}/api/users/self/push/subscriptions/${id}/tests`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ id }) },
    );

  it('answers 503 when the Worker has no VAPID keys', async () => {
    restore();
    install(false);
    await post(GOOD);
    expect((await test(await subscriptionId(ENDPOINT))).status).toBe(503);
  });

  it('answers 404 for a subscription that is not the person’s', async () => {
    await post(GOOD);
    session.uid = 8;
    expect((await test(await subscriptionId(ENDPOINT))).status).toBe(404);
  });
});
