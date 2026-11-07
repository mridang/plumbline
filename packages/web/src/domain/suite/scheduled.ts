/**
 * @packageDocumentation
 *
 * The cron trigger's work. It re-checks the sites found through GitHub that have
 * not been checked for six hours, so a problem that did not come from a
 * deployment (a site that went down, a page changed from outside the
 * repository) is still noticed, and it re-reads the GitHub installation read
 * longest ago, so a repository deleted or added while no webhook reached us is
 * still noticed. Each trigger takes only a few sites, the ones checked longest
 * ago, because a scan takes the container tens of seconds; the trigger fires
 * often enough that every site is reached soon after it falls due. A run that
 * failed, because the scanner was busy or restarting, does not count as a
 * check, so the site stays due. A repository whose checks a person turned off
 * is never re-checked. Every check is run by the scanner container, so a
 * trigger awaits its scans: the work is waiting for the container, not CPU.
 */

import { createDatabase, type Database } from '@/domain/db/client';
import { staleInstallation, touchInstallation } from '@/domain/db/github';
import { dueSites } from '@/domain/db/suite';
import { readGitHubConfig } from '@/domain/github/config';
import { syncAsApp } from '@/domain/github/service';
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

/** A site is due again after this long without a check, in milliseconds (the trigger looks every ten minutes). */
export const RECHECK_AFTER_MS = 6 * 60 * 60 * 1000;

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
      { ...deps, kind: 'scheduled' },
    ),
  );
}

/**
 * Read the installation read longest ago, if that was over six hours back, so a
 * repository deleted, renamed or moved while no webhook reached us still leaves
 * the dashboard, and one added or changed is still found. One installation per
 * trigger keeps the work small; the trigger fires often enough to reach all.
 */
export async function resyncStaleInstallation(
  db: Database,
  sync: (userId: number, installationId: number) => Promise<unknown>,
  now: () => Date = () => new Date(),
): Promise<void> {
  const stale = await staleInstallation(
    db,
    new Date(now().getTime() - RECHECK_AFTER_MS).toISOString(),
  );
  if (stale) {
    try {
      await sync(stale.user_id, stale.installation_id);
    } catch (error) {
      console.error('github resync failed', stale.installation_id, error);
      // A read that failed counts as an attempt: left as it was, the same
      // installation would be the oldest again at every trigger and keep every
      // other one from being reached.
      await touchInstallation(db, stale.installation_id, now().toISOString());
    }
  }
}

/** The Worker's `scheduled` handler. It returns when the scans are done. */
export const scheduled: ExportedHandlerScheduledHandler<CloudflareEnv> = async (
  _controller,
  env,
) => {
  const db = createDatabase(env.DB);
  const config = readGitHubConfig(env);
  if (config) {
    await resyncStaleInstallation(db, (userId, installationId) =>
      syncAsApp(db, config, userId, installationId),
    );
  }
  const namespace = env.SCANNER as unknown as ScannerNamespace | undefined;
  await checkDueSites(db, {
    limits: scanLimits(readLimits(env)),
    live: createLive(db, env),
    run: async (url) => suiteRunOf(await scanThrough(namespace, url)),
  });
};
