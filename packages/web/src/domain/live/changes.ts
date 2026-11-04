/**
 * @packageDocumentation
 *
 * What is worth a notification: a site that breaks, is fixed, stops answering,
 * or whose number of problems changes. Pure, so the words are easy to read in
 * a test.
 */

import type { Counts } from '@/domain/db/live';

/** The problems of a check: errors and warnings (hints are only advice). */
export function problemsIn(counts: Readonly<Counts>): number {
  return counts.errors + counts.warnings;
}

/** `1 problem` or `3 problems`. */
function problems(n: number): string {
  return `${n} problem${n === 1 ? '' : 's'}`;
}

/** A notification: its title and its body. */
export interface Message {
  readonly title: string;
  readonly body: string;
}

/**
 * What to tell the person after a check, or null when nothing changed that
 * matters. `before` is null for a site never checked, and `after` is null when
 * the site did not answer.
 */
export function describeChange(
  host: string,
  before: Readonly<Counts> | null,
  after: Readonly<Counts> | null,
): Message | null {
  if (after === null) {
    return {
      title: `${host} did not answer`,
      body: 'The check could not reach the site.',
    };
  }
  if (before === null) {
    return after.errors > 0
      ? {
          title: `${host} is broken`,
          body: `The first check found ${problems(problemsIn(after))}, ${after.errors} of them errors.`,
        }
      : null;
  }
  if (before.errors === 0 && after.errors > 0) {
    return {
      title: `${host} is broken`,
      body: `Now ${problems(problemsIn(after))}, ${after.errors} of them errors (was ${problemsIn(before)}).`,
    };
  }
  if (before.errors > 0 && after.errors === 0) {
    return {
      title: `${host} is fixed`,
      body: `No errors any more; ${problems(problemsIn(after))} left (was ${problemsIn(before)}).`,
    };
  }
  if (problemsIn(before) !== problemsIn(after)) {
    return {
      title: `${host} changed`,
      body: `Now ${problems(problemsIn(after))} (was ${problemsIn(before)}).`,
    };
  }
  return null;
}
