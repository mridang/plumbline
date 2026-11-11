import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { addDomain } from '@/domain/db/domains';
import { overviewOf } from '@/domain/db/live';
import { replaceAccess } from '@/domain/db/access';
import { createLive } from '@/domain/live/live';
import { PushSubscriptionRepository } from '@/domain/push/repository';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

/** A real P-256 key pair as a browser would give: the public key and a random auth secret. */
async function keys() {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const raw = Buffer.from(
    await crypto.subtle.exportKey('raw', pair.publicKey),
  ).toString('base64url');
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return {
    publicKey: raw,
    privateKey: String(jwk.d),
    auth: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
      'base64url',
    ),
  };
}

/** A hub namespace that records which people it was told about. */
function hubs(fail = false) {
  const told: string[] = [];
  return {
    told,
    namespace: {
      idFromName: (name: string) => name,
      get: (name: string) => ({
        notify: async () => {
          if (fail) {
            throw new Error('hub down');
          }
          told.push(name);
        },
      }),
    },
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

async function setup(withPush = true) {
  const { d1, raw } = sqliteD1(...APP_MIGRATIONS);
  const db = createDatabase(d1);
  await addDomain(db, 1, 'a.test', 'acme/site');
  const vapid = await keys();
  const device = await keys();
  const store = new PushSubscriptionRepository(db);
  await store.upsert(
    {
      endpoint: 'https://push.test/device',
      user_id: 1,
      p256dh: device.publicKey,
      auth: device.auth,
    },
    'now',
  );
  const env = withPush
    ? {
        VAPID_PUBLIC_KEY: vapid.publicKey,
        VAPID_PRIVATE_KEY: vapid.privateKey,
        VAPID_SUBJECT: 'mailto:a@b.test',
      }
    : {};
  return { db, raw, env };
}

const site = { host: 'a.test', repo: 'acme/site' };
const found = (errors: number, warnings = 0) => ({
  errors,
  warnings,
  hints: 0,
});

describe('createLive, for everyone who can see the repository', () => {
  it('tells the person it belongs to and each person who can see its repository, and no one else', async () => {
    const { db, raw } = await setup();
    await replaceAccess(db, 2, ['acme/site']);
    await replaceAccess(db, 3, ['acme/other']);
    const hub = hubs();
    await createLive(db, { USER_HUB: hub.namespace }).started(1, site, 'now');
    expect(hub.told.toSorted((a, b) => Number(a > b) - Number(a < b))).toEqual([
      '1',
      '2',
    ]);
    const users = raw
      .prepare('SELECT DISTINCT user_id FROM live_events ORDER BY user_id')
      .all()
      .map((row) => row['user_id']);
    expect(users).toEqual([1, 2]);
  });

  it('sends the push to their subscriptions too', async () => {
    const { db, env } = await setup();
    await replaceAccess(db, 2, ['acme/site']);
    const store = new PushSubscriptionRepository(db);
    const device = await keys();
    await store.upsert(
      {
        endpoint: 'https://push.test/member',
        user_id: 2,
        p256dh: device.publicKey,
        auth: device.auth,
      },
      'now',
    );
    const fetched = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 201 }));
    await createLive(db, env).finished(1, site, {
      before: found(0),
      after: found(3),
      at: 'now',
    });
    expect(
      fetched.mock.calls
        .map((call) => String(call[0]))
        .toSorted((a, b) => Number(a > b) - Number(a < b)),
    ).toEqual(['https://push.test/device', 'https://push.test/member']);
  });
});

describe('a check that broke on our side', () => {
  it('stops showing the site as running and sends no push and no event', async () => {
    const { db, raw, env } = await setup();
    const store = new PushSubscriptionRepository(db);
    const device = await keys();
    await store.upsert(
      {
        endpoint: 'https://push.test/device',
        user_id: 1,
        p256dh: device.publicKey,
        auth: device.auth,
      },
      'now',
    );
    const fetched = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 201 }));
    await createLive(db, env).started(1, site, 'then');
    await createLive(db, env).finished(1, site, {
      before: null,
      after: null,
      at: 'now',
      failed: true,
    });
    const row = raw
      .prepare('select checking_since, reachable from domains where host = ?')
      .get(site.host) as Record<string, unknown>;
    expect(row['checking_since']).toBeNull();
    expect(row['reachable']).not.toBe(0);
    expect(fetched).not.toHaveBeenCalled();
  });
});

describe('createLive', () => {
  it('marks the site as running, records the event and wakes the hub', async () => {
    const { db, raw, env } = await setup();
    const hub = hubs();
    const live = createLive(db, { ...env, USER_HUB: hub.namespace });
    await live.started(1, site, '2026-01-01T00:00:00.000Z');
    expect(hub.told).toEqual(['1']);
    expect(
      raw
        .prepare('SELECT payload FROM live_events')
        .all()
        .map((r) => r['payload']),
    ).toEqual([
      '{"type":"started","host":"a.test","repo":"acme/site","at":"2026-01-01T00:00:00.000Z"}',
    ]);
    const running = await overviewOf(
      db,
      1,
      Date.parse('2026-01-01T00:01:00.000Z'),
    );
    expect(running[0]?.sites[0]?.state).toBe('running');
  });

  it('stores what a check found and tells subscribers when it matters', async () => {
    const { db, env } = await setup();
    const fetched = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 201 }));
    const live = createLive(db, env);
    await live.finished(1, site, {
      before: found(0),
      after: found(3, 1),
      at: 'now',
    });
    const overview = await overviewOf(db, 1);
    expect(overview[0]?.sites[0]).toMatchObject({
      state: 'failing',
      errors: 3,
      warnings: 1,
    });
    expect(fetched).toHaveBeenCalledTimes(1);
    expect(String(fetched.mock.calls[0]?.[0])).toBe('https://push.test/device');
  });

  it('sends nothing when the number of problems did not change', async () => {
    const { db, env } = await setup();
    const fetched = jest.spyOn(globalThis, 'fetch');
    await createLive(db, env).finished(1, site, {
      before: found(2),
      after: found(2),
      at: 'now',
    });
    expect(fetched).not.toHaveBeenCalled();
  });

  it('sends nothing when the Worker has no VAPID keys, and still records the check', async () => {
    const { db, env } = await setup(false);
    const fetched = jest.spyOn(globalThis, 'fetch');
    await createLive(db, env).finished(1, site, {
      before: found(0),
      after: found(4),
      at: 'now',
    });
    expect(fetched).not.toHaveBeenCalled();
    const overview = await overviewOf(db, 1);
    expect(overview[0]?.sites[0]?.state).toBe('failing');
  });

  it('records a site that did not answer', async () => {
    const { db, env } = await setup();
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 201 }));
    await createLive(db, env).finished(1, site, {
      before: found(0),
      after: null,
      at: 'now',
    });
    const overview = await overviewOf(db, 1);
    expect(overview[0]?.sites[0]?.state).toBe('unreachable');
  });

  it('never fails the check when the hub or the push service is down', async () => {
    const { db, env } = await setup();
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const live = createLive(db, { ...env, USER_HUB: hubs(true).namespace });
    await expect(live.started(1, site, 'now')).resolves.toBeUndefined();
    await expect(
      live.finished(1, site, { before: found(0), after: found(2), at: 'now' }),
    ).resolves.toBeUndefined();
  });
});
