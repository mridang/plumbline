/**
 * @packageDocumentation
 *
 * What one Worker invocation may do, by Cloudflare plan. The Free plan allows
 * 10 ms of CPU and 50 subrequests per invocation and five cron triggers per
 * account; the Paid plan allows far more of each and bills CPU time by the
 * millisecond. Every number that depends on the plan is here, so moving to
 * Paid is one setting (`WORKERS_PLAN=paid`) and nothing else in the code
 * changes. Anything other than `paid` means Free, the safe side.
 */

/** The limits a plan allows the server-side checks. */
export interface Limits {
  /** Sites checked for one deployment. */
  readonly maxSites: number;
  /** Sites a cron trigger re-checks. */
  readonly scheduledBatch: number;
  /** Sites checked at the same time within one invocation. */
  readonly concurrency: number;
  /** How often the cron trigger should fire, as a cron expression. */
  readonly cron: string;
}

/** Free: a few sites per invocation, one at a time per the CPU budget. */
export const FREE_LIMITS: Limits = {
  maxSites: 5,
  scheduledBatch: 3,
  concurrency: 5,
  cron: '*/30 * * * *',
};

/** Paid: 30 s of CPU and 10,000 subrequests per invocation. */
export const PAID_LIMITS: Limits = {
  maxSites: 25,
  scheduledBatch: 20,
  concurrency: 10,
  cron: '*/10 * * * *',
};

/** Scans the container runs at once: each runs every check, so a few fill it. */
export const SCAN_CONCURRENCY = 3;

/** `limits`, with no more scans at once than the container takes. */
export function scanLimits(limits: Readonly<Limits>): Limits {
  return {
    ...limits,
    concurrency: Math.min(limits.concurrency, SCAN_CONCURRENCY),
  };
}

/** The limits for the plan named in `WORKERS_PLAN`; Free when it is missing or unknown. */
export function readLimits(env: Readonly<{ WORKERS_PLAN?: string }>): Limits {
  return env.WORKERS_PLAN?.trim().toLowerCase() === 'paid'
    ? PAID_LIMITS
    : FREE_LIMITS;
}

/** Runs `task` for each item, at most `size` at a time, and returns the results in order. */
export async function inBatches<T, R>(
  items: readonly T[],
  size: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let at = 0; at < items.length; at += Math.max(1, size)) {
    results.push(
      ...(await Promise.all(items.slice(at, at + Math.max(1, size)).map(task))),
    );
  }
  return results;
}
