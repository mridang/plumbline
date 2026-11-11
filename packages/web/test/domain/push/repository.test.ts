import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { PushSubscriptionRepository } from '@/domain/push/repository';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const repo = () =>
  new PushSubscriptionRepository(
    createDatabase(sqliteD1(...APP_MIGRATIONS).d1),
  );

const sub = (endpoint: string, userId = 1, p256dh = 'p') => ({
  endpoint,
  user_id: userId,
  p256dh,
  auth: 'a',
});

describe('PushSubscriptionRepository', () => {
  it('lists a person’s subscriptions and no one else’s', async () => {
    const store = repo();
    await store.upsert(sub('https://p.test/1'), 'now');
    await store.upsert(sub('https://p.test/2', 2), 'now');
    const subs = await store.listForUser(1);
    expect(subs.map((s) => s.endpoint)).toEqual(['https://p.test/1']);
    expect(await store.listAll()).toHaveLength(2);
  });

  it('replaces the keys and the owner when the same endpoint registers again', async () => {
    const store = repo();
    await store.upsert(sub('https://p.test/1', 1, 'old'), 'now');
    await store.upsert(sub('https://p.test/1', 2, 'new'), 'later');
    expect(await store.listForUser(1)).toEqual([]);
    expect(await store.listForUser(2)).toEqual([
      sub('https://p.test/1', 2, 'new'),
    ]);
  });

  it('removes a subscription, and removing it twice is fine', async () => {
    const store = repo();
    await store.upsert(sub('https://p.test/1'), 'now');
    await store.remove('https://p.test/1');
    await store.remove('https://p.test/1');
    expect(await store.listAll()).toEqual([]);
  });

  it('stamps the time of the last send', async () => {
    const store = repo();
    await store.upsert(sub('https://p.test/1'), 'now');
    await expect(
      store.markSent('https://p.test/1', 'later'),
    ).resolves.toBeUndefined();
  });
});
