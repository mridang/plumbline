/**
 * @packageDocumentation
 *
 * The cooldown between scans of one page: a page (its canonical URL, see
 * `target.ts`) may be scanned once every {@link SCAN_COOLDOWN} window, by
 * anyone. A scan sends a few dozen requests to the site through the Worker, so
 * without it the app could be used to hammer a site, and a page does not
 * change in five minutes. The per-address limits at the edge (`RL_SCAN`,
 * `RL_FETCH`) stop one visitor from starting many scans; this stops many
 * visitors from scanning one page.
 *
 * The counters are the shared fixed-window ones in D1 (`lib/rate-limit.ts`),
 * the same the MCP and OAuth limits use. If they cannot be reached the scan
 * goes ahead and the fault is logged: the cooldown is a safeguard, and a
 * database hiccup should not take scanning down.
 */

import { runInBackground } from '@/lib/core/runtime';
import { getDatabase } from '@/domain/db/client';
import { errorMessage, logError } from '@/utils/logging';
import {
  D1RateLimitStore,
  purgeRateLimits,
  rateLimit,
  type RateDecision,
  type RateLimit,
  type RateLimitStore,
} from '@/lib/rate-limit';

/** One scan of a page every five minutes. */
export const SCAN_COOLDOWN = {
  name: 'scan-page',
  limit: 1,
  windowSeconds: 300,
} as const satisfies RateLimit;

/** The fraction of scans that also sweep away idle counters. */
export const PURGE_PROBABILITY = 0.01;

/** How long, in seconds, a counter must have been idle before a sweep removes it. */
export const PURGE_IDLE_SECONDS = 3600;

/** Where the cooldown keeps its counters and how it tells the time and rolls dice. */
export interface CooldownDeps {
  /** The counters; a function so the database is only touched when a scan starts. */
  readonly store: () => RateLimitStore;
  /** The time now, in Unix seconds. */
  readonly now: () => number;
  /** A random number in [0, 1), for deciding when to sweep idle counters. */
  readonly random: () => number;
}

/** The real thing: counters in D1, the clock and `Math.random`. */
export function liveCooldownDeps(): CooldownDeps {
  return {
    store: () => new D1RateLimitStore(getDatabase().$client),
    now: () => Math.floor(Date.now() / 1000),
    random: Math.random,
  };
}

/**
 * Count a scan of `url` (already canonical) and say whether it may go ahead.
 * Now and then this also sweeps away counters that have been idle for an hour.
 */
export async function claimScan(
  url: string,
  deps: CooldownDeps = liveCooldownDeps(),
): Promise<RateDecision> {
  try {
    const store = deps.store();
    const now = deps.now();
    const decision = await rateLimit(store, SCAN_COOLDOWN, url, now);
    if (deps.random() < PURGE_PROBABILITY) {
      runInBackground(
        purgeRateLimits(store, PURGE_IDLE_SECONDS, now).catch(
          (error: unknown) => {
            logError({
              event: 'scan.cooldown.purge_failed',
              error: errorMessage(error),
            });
          },
        ),
      );
    }
    return decision;
  } catch (error) {
    logError({ event: 'scan.cooldown.failed', error: errorMessage(error) });
    return { allowed: true, remaining: 0 };
  }
}

/** The sentence a refused scan answers with. */
export function cooldownMessage(
  url: string,
  retryAfterSeconds: number,
): string {
  const minutes = Math.floor(retryAfterSeconds / 60);
  const seconds = retryAfterSeconds % 60;
  const wait =
    minutes === 0
      ? `${seconds} s`
      : `${minutes} min${seconds === 0 ? '' : ` ${seconds} s`}`;
  return `${url} was checked less than ${SCAN_COOLDOWN.windowSeconds / 60} minutes ago. A page can be checked once every ${SCAN_COOLDOWN.windowSeconds / 60} minutes; try again in ${wait}.`;
}
