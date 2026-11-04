/**
 * @packageDocumentation
 *
 * A relay that makes each distinct request once. The scan workers run side by
 * side, and many checks ask for the same address (the page, `robots.txt`, the
 * favicon). Wrapping the relay here, without touching any check, means the
 * target is asked once however many checks want the answer: requests made
 * while one is in flight share it, and an answer is kept for the rest of the
 * scan. A request that failed is remembered too, for a short while, so a dead
 * address is not hammered by every check that wants it. A scan is over in a
 * minute or two, so this never serves anything older than that; the Worker's
 * cache (see `http-cache.ts`) is what honours `Cache-Control` and validators
 * between scans.
 */

import type { Relay, RelayRequest, Relayed } from './relay';

/** How long a failure is remembered, in milliseconds. */
export const FAILURE_MEMO_MS = 15_000;

/** The same request gives the same key whatever the order of its headers. */
export function keyOf(request: Readonly<RelayRequest>): string {
  const headers = Object.entries(request.headers)
    .map(([name, value]) => [name.toLowerCase(), value] as const)
    .toSorted(([a], [b]) => a.localeCompare(b));
  return `${request.method} ${request.url}\n${JSON.stringify(headers)}`;
}

/** A relay that asks `relay` once per distinct request. */
export function sharedRelay(
  relay: Relay,
  now: () => number = () => Date.now(),
): Relay {
  const answers = new Map<string, Promise<Relayed>>();
  const failedAt = new Map<string, number>();
  return (request) => {
    const key = keyOf(request);
    const failed = failedAt.get(key);
    if (failed !== undefined && now() - failed >= FAILURE_MEMO_MS) {
      answers.delete(key);
      failedAt.delete(key);
    }
    let pending = answers.get(key);
    if (!pending) {
      pending = relay(request);
      answers.set(key, pending);
      pending.catch(() => failedAt.set(key, now()));
    }
    return pending;
  };
}
