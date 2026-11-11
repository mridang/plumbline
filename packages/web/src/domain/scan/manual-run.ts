/**
 * @packageDocumentation
 *
 * How often a person may run a site's checks by hand: once every five
 * minutes. A run sends a few hundred requests to the site from the scanner
 * container, and a site does not change in five minutes. The scan cooldown
 * (`cooldown.ts`) already stops the same page from being scanned twice in that
 * time by anyone; this is the same rule seen from the site's history, which
 * both refuses a report that would break it and tells the page how long to
 * wait. Runs the server starts (a deployment, the daily re-check) are not
 * limited by it.
 */

/** The time between two manual runs of one site, in seconds. */
export const MANUAL_RUN_INTERVAL_SECONDS = 300;

/**
 * The moment (in milliseconds) the site may be run by hand again, given when
 * it last was (`lastRunAt`, an ISO time); 0 when it never was, or the time is
 * unreadable.
 */
export function nextRunAt(lastRunAt: string | undefined): number {
  if (lastRunAt === undefined) {
    return 0;
  }
  const last = Date.parse(lastRunAt);
  return Number.isNaN(last) ? 0 : last + MANUAL_RUN_INTERVAL_SECONDS * 1000;
}

/**
 * How many whole seconds remain until `untilMs`, rounded up so a part-second
 * still counts, and never more than the interval (a clock that reads before
 * the last run does not make the wait longer); 0 once it has come.
 */
export function secondsLeft(untilMs: number, nowMs: number): number {
  return Math.min(
    MANUAL_RUN_INTERVAL_SECONDS,
    Math.max(0, Math.ceil((untilMs - nowMs) / 1000)),
  );
}

/**
 * How many whole seconds remain before the site may be run by hand again,
 * given when it last was and the time now in milliseconds; 0 when it may be
 * run now, or was never run.
 */
export function secondsUntilNextRun(
  lastRunAt: string | undefined,
  nowMs: number,
): number {
  return secondsLeft(nextRunAt(lastRunAt), nowMs);
}

/** A wait as minutes and seconds, as a clock reads it: 299 is "4:59". */
export function formatCountdown(seconds: number): string {
  const rest = String(seconds % 60).padStart(2, '0');
  return `${Math.floor(seconds / 60)}:${rest}`;
}

/** The sentence a refused run answers with, and the button shows. */
export function waitMessage(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const restPart = rest === 0 ? '' : ` ${rest} s`;
  const wait = minutes === 0 ? `${rest} s` : `${minutes} min${restPart}`;
  return `The checks were run by hand less than ${MANUAL_RUN_INTERVAL_SECONDS / 60} minutes ago. A site can be run once every ${MANUAL_RUN_INTERVAL_SECONDS / 60} minutes; try again in ${wait}.`;
}
