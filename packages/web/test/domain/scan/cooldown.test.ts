import { describe, expect, it } from '@jest/globals';

import {
  claimScan,
  cooldownMessage,
  PURGE_IDLE_SECONDS,
  SCAN_COOLDOWN,
  type CooldownDeps,
} from '@/domain/scan/cooldown';
import type { RateLimitStore } from '@/lib/rate-limit';

/** A fake set of counters: fixed windows held in a map. */
function memoryStore() {
  const counters = new Map<string, { count: number; windowStart: number }>();
  const purged: number[] = [];
  const store: RateLimitStore = {
    async hit(key, now, windowSeconds) {
      const found = counters.get(key);
      const next =
        found && found.windowStart > now - windowSeconds
          ? { ...found, count: found.count + 1 }
          : { count: 1, windowStart: now };
      counters.set(key, next);
      return next;
    },
    async purge(before) {
      purged.push(before);
    },
  };
  return { store, counters, purged };
}

const deps = (
  store: RateLimitStore,
  over: Partial<CooldownDeps> = {},
): CooldownDeps => ({
  store: () => store,
  now: () => 1000,
  random: () => 0.5,
  ...over,
});

const PAGE = 'https://example.com/';

describe('SCAN_COOLDOWN', () => {
  it('allows one scan of a page every five minutes', () => {
    expect(SCAN_COOLDOWN).toMatchObject({ limit: 1, windowSeconds: 300 });
  });
});

describe('claimScan', () => {
  it('lets the first scan of a page go ahead', async () => {
    const { store } = memoryStore();
    expect(await claimScan(PAGE, deps(store))).toMatchObject({
      allowed: true,
    });
  });

  it('refuses a second scan of the page within five minutes, saying how long to wait', async () => {
    const { store } = memoryStore();
    await claimScan(PAGE, deps(store));
    expect(
      await claimScan(PAGE, deps(store, { now: () => 1000 + 120 })),
    ).toEqual({ allowed: false, retryAfterSeconds: 180 });
  });

  it('lets the page be scanned again once five minutes have passed', async () => {
    const { store } = memoryStore();
    await claimScan(PAGE, deps(store));
    expect(
      await claimScan(PAGE, deps(store, { now: () => 1000 + 300 })),
    ).toMatchObject({ allowed: true });
  });

  it('counts each page on its own', async () => {
    const { store } = memoryStore();
    await claimScan(PAGE, deps(store));
    expect(
      await claimScan('https://example.com/other', deps(store)),
    ).toMatchObject({ allowed: true });
  });

  it('keys the counter by the page', async () => {
    const { store, counters } = memoryStore();
    await claimScan(PAGE, deps(store));
    expect([...counters.keys()]).toEqual([`scan-page:${PAGE}`]);
  });

  it('now and then sweeps away counters idle for an hour', async () => {
    const { store, purged } = memoryStore();
    await claimScan(PAGE, deps(store, { random: () => 0 }));
    await Promise.resolve();
    expect(purged).toEqual([1000 - PURGE_IDLE_SECONDS]);
  });

  it('does not sweep on most scans', async () => {
    const { store, purged } = memoryStore();
    await claimScan(PAGE, deps(store));
    expect(purged).toEqual([]);
  });

  it('lets the scan go ahead when the counters cannot be reached', async () => {
    const broken: RateLimitStore = {
      hit: () => Promise.reject(new Error('down')),
      purge: () => Promise.resolve(),
    };
    expect(await claimScan(PAGE, deps(broken))).toMatchObject({
      allowed: true,
    });
  });
});

describe('cooldownMessage', () => {
  it.each([
    [180, 'try again in 3 min.'],
    [185, 'try again in 3 min 5 s.'],
    [42, 'try again in 42 s.'],
  ])('words a wait of %i seconds', (seconds, ending) => {
    const message = cooldownMessage(PAGE, seconds);
    expect(message).toContain(`${PAGE} was checked less than 5 minutes ago.`);
    expect(message.endsWith(ending)).toBe(true);
  });
});
