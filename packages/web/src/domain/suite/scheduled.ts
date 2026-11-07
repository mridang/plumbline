/**
 * @packageDocumentation
 *
 * The cron trigger's work. It re-checks the sites found through GitHub that have
 * not been checked for six hours, so a problem that did not come from a
 * deployment (a site that went down, a page changed from outside the
 * repository) is still noticed, and it re-reads the GitHub installation read
 * longest ago, so a repository deleted or added while no webhook reached us is
 * still noticed. It does not scan anything itself: it leaves a re-check of each
 * due site (the ones checked longest ago first) with the scan queue
 * (`domain/suite/queue.ts`), which runs them in scanner containers of their
 * own, and sends again the jobs that have waited too long. A run that failed,
 * because the scanner was busy or restarting, does not count as a check, so the
 * site stays due. A repository whose checks a person turned off is never
 * re-checked.
 */

import { createDatabase, type Database } from '@/domain/db/client';
import { staleInstallation, touchInstallation } from '@/domain/db/github';
import { dueSites } from '@/domain/db/suite';
import { readGitHubConfig } from '@/domain/github/config';
import { syncAsApp } from '@/domain/github/service';
import { FREE_LIMITS, readLimits } from '@/domain/suite/limits';
import {
  enqueueScan,
  sweepPending,
  type ScanQueue,
} from '@/domain/suite/queue';

/** Sites checked by one trigger on the Free plan. */
export const SCHEDULED_BATCH = FREE_LIMITS.scheduledBatch;

/** A site is due again after this long without a check, in milliseconds (the trigger looks every ten minutes). */
export const RECHECK_AFTER_MS = 6 * 60 * 60 * 1000;

/**
 * Leave a re-check of each due site with the scan queue, which runs them in
 * their own containers. Returns how many were sent: a site that is due and
 * already waiting is not sent again.
 */
export async function enqueueDueSites(
  db: Database,
  queue: ScanQueue | undefined,
  options: Readonly<{ batch?: number; now?: () => Date }> = {},
): Promise<number> {
  const now = options.now ?? (() => new Date());
  const due = await dueSites(
    db,
    new Date(now().getTime() - RECHECK_AFTER_MS).toISOString(),
    options.batch ?? SCHEDULED_BATCH,
  );
  let sent = 0;
  for (const site of due) {
    try {
      const queued = await enqueueScan(
        db,
        queue,
        {
          kind: 'recheck',
          userId: site.user_id,
          host: site.host,
          repo: site.repo ?? '',
        },
        now(),
      );
      sent += queued ? 1 : 0;
    } catch (error) {
      console.error('re-check not queued', site.host, error);
    }
  }
  return sent;
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

/** The Worker's `scheduled` handler. It only queues work, so it returns at once. */
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
  const queue = env.SCAN_QUEUE;
  await enqueueDueSites(db, queue, {
    batch: readLimits(env).scheduledBatch,
  });
  // Jobs whose messages were lost or dead-lettered are sent again.
  if (queue) {
    await sweepPending(db, queue);
  }
};
