'use client';

import { useSyncExternalStore, type ReactElement } from 'react';

import { formatTimestamp, relativeTime } from '@/lib/intl';

/** How often the words are worked out again, in milliseconds. */
export const TICK_MS = 30_000;

/** The listeners of the one shared clock. */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

/** Starts the shared clock with the first listener and stops it with the last. */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  timer ??= setInterval(() => {
    for (const each of listeners) {
      each();
    }
  }, TICK_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** The time now, in whole ticks, so a render only changes when the words may. */
function snapshot(): number {
  return Math.floor(Date.now() / TICK_MS) * TICK_MS;
}

/**
 * A moment as words ("2 hours ago", "in 5 minutes"), with the full date and
 * time in UTC as its tooltip. The page that draws it hands over the time the
 * server read (`now`), so the first paint is the same on the server and in the
 * browser; after that one shared clock refreshes every instance twice a minute.
 */
export function RelativeTime({
  at,
  now,
  className,
}: Readonly<{
  /** The moment, as an ISO timestamp. */
  at: string;

  /**
   * The server's clock when the page was made, in milliseconds. Leave it out
   * only where nothing is drawn on the server (a result that appears after a
   * scan has run in the browser).
   */
  now?: number;
  className?: string;
}>): ReactElement {
  const current = useSyncExternalStore(
    subscribe,
    snapshot,
    () => now ?? snapshot(),
  );
  return (
    <time
      dateTime={at}
      title={`${formatTimestamp(at)} UTC`}
      className={className}
    >
      {relativeTime(at, new Date(current))}
    </time>
  );
}
