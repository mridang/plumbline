/**
 * @packageDocumentation
 *
 * A relay that makes each distinct request once. The scan workers run side by
 * side, and many checks ask for the same address (the page, `robots.txt`, the
 * favicon). Wrapping the relay here, without touching any check, means the
 * target is asked once however many checks want the answer: requests made
 * while one is in flight share it, and an answer is kept for the rest of the
 * scan. Nothing is kept by time and nothing outlives the scan: a failure is
 * forgotten at once, so asking again is a new request.
 */

import type { Relay, RelayRequest, Relayed } from './relay';

/** The same request gives the same key whatever the order of its headers. */
export function keyOf(request: Readonly<RelayRequest>): string {
  const headers = Object.entries(request.headers)
    .map(([name, value]) => [name.toLowerCase(), value] as const)
    .toSorted(([a], [b]) => a.localeCompare(b));
  return `${request.method} ${request.url}\n${JSON.stringify(headers)}`;
}

/** A relay that asks `relay` once per distinct request. */
export function sharedRelay(relay: Relay): Relay {
  const answers = new Map<string, Promise<Relayed>>();
  return (request) => {
    const key = keyOf(request);
    let pending = answers.get(key);
    if (!pending) {
      pending = relay(request);
      answers.set(key, pending);
      // A failure is not remembered: asking again is a new request.
      pending.catch(() => answers.delete(key));
    }
    return pending;
  };
}
