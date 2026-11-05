/**
 * @packageDocumentation
 *
 * The cron trigger's work: re-check the sites found through GitHub that have
 * not been checked for a day, so a problem that did not come from a deployment
 * (a site that went down, a page changed from outside the repository) is still
 * noticed. Each trigger takes only a few sites, the ones checked longest ago,
 * because a scan takes the container tens of seconds; the trigger fires often
 * enough that every site is reached within the
 * day. Every check is run by the scanner container, so a trigger awaits its
 * scans: the work is waiting for the container, not CPU.
 */

import { createDatabase, type Database } from '@/domain/db/client';
import { dueSites } from '@/domain/db/suite';
import { createLive } from '@/domain/live/live';
import {
  FREE_LIMITS,
  inBatches,
  readLimits,
  scanLimits,
} from '@/domain/suite/limits';
import { checkSite, type Deps, type SiteOutcome } from '@/domain/suite/deploy';
import { suiteRunOf } from '@/domain/suite/run';
import { scanThrough, type ScannerNamespace } from '@/domain/suite/scanner';

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

/** The Worker's `scheduled` handler. It returns when the scans are done. */
export const scheduled: ExportedHandlerScheduledHandler<CloudflareEnv> = async (
  _controller,
  env,
) => {
  const db = createDatabase(env.DB);
  const namespace = env.SCANNER as unknown as ScannerNamespace | undefined;
  await checkDueSites(db, {
    limits: scanLimits(readLimits(env)),
    live: createLive(db, env),
    run: async (url) => suiteRunOf(await scanThrough(namespace, url)),
  });
};
