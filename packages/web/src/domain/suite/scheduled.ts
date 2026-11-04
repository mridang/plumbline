/**
 * @packageDocumentation
 *
 * The cron trigger's work: re-check the sites found through GitHub that have
 * not been checked for a day, so a problem that did not come from a deployment
 * (a site that went down, a page changed from outside the repository) is still
 * noticed. Each trigger takes only a few sites, the ones checked longest ago,
 * because a Worker invocation has 50 subrequests and, on the Free plan, 10 ms
 * of CPU; the trigger fires often enough that every site is reached within the
 * day.
 */

import { createDatabase, type Database } from '@/domain/db/client';
import { dueSites } from '@/domain/db/suite';
import { FREE_LIMITS, inBatches, readLimits } from '@/domain/suite/limits';
import { checkSite, type Deps, type SiteOutcome } from '@/domain/suite/deploy';

/** Sites checked by one trigger on the Free plan. */
export const SCHEDULED_BATCH = FREE_LIMITS.scheduledBatch;

/** A site is due again after this long, in milliseconds. */
export const RECHECK_AFTER_MS = 24 * 60 * 60 * 1000;

/** Re-check the sites that are due. */
export async function checkDueSites(
  db: Database,
  deps: Deps = {},
): Promise<SiteOutcome[]> {
  const now = deps.now ?? (() => new Date());
  const limits = deps.limits ?? FREE_LIMITS;
  const due = await dueSites(
    db,
    new Date(now().getTime() - RECHECK_AFTER_MS).toISOString(),
    limits.scheduledBatch,
  );
  return inBatches(due, limits.concurrency, (site) =>
    checkSite(
      db,
      site.user_id,
      { host: site.host, repo: site.repo, sha: null },
      deps,
    ),
  );
}

/** The Worker's `scheduled` handler. */
export const scheduled: ExportedHandlerScheduledHandler<CloudflareEnv> = (
  _controller,
  env,
  ctx,
) => {
  ctx.waitUntil(
    checkDueSites(createDatabase(env.DB), { limits: readLimits(env) }),
  );
};
