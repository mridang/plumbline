/**
 * @packageDocumentation
 *
 * The scans waiting for the scan queue (table `pending_scans`). The queue's
 * message only names a key; the job itself is kept here, so that
 *
 * - a newer job for the same key replaces an older one that has not started
 *   (several deployments in a row cause one scan, of the newest commit);
 * - a job a consumer was running when it crashed is still here for the retry,
 *   and a job whose messages were all dead-lettered is still here for the next
 *   scheduled re-check to revive (nothing is lost with the message);
 * - a consumer that finishes an old job never deletes a newer one (`seq`).
 *
 * Every statement goes by the primary key (`key`), one row at a time.
 */

import { and, asc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { pendingScans } from '@/domain/db/schema';

/** A job, as a consumer takes it. */
export interface ClaimedScan {
  readonly seq: number;
  /** The job as it was put, JSON text. */
  readonly job: string;
}

/**
 * Put `job` under `key`, replacing the job already waiting there. Returns the
 * job's sequence number when a message must be sent for it, and null when one
 * is already on its way: a `force`d put (a deployment, which is newer than
 * anything waiting) always sends one, an unforced put (the scheduled re-check,
 * which repeats until the site is checked) sends one only for a new row or for
 * a row older than `staleBefore`, whose messages are presumed lost.
 */
export async function putPending(
  db: Database,
  key: string,
  job: string,
  now: string,
  options: Readonly<{ force: boolean; staleBefore: string }>,
): Promise<number | null> {
  const put = await db
    .insert(pendingScans)
    .values({ key, job, seq: 1, enqueued_at: now, claimed_at: null })
    .onConflictDoUpdate({
      target: pendingScans.key,
      set: {
        job,
        seq: sql`${pendingScans.seq} + 1`,
        enqueued_at: now,
        claimed_at: null,
      },
      // An unforced put leaves a waiting job alone unless it has gone stale.
      ...(options.force
        ? {}
        : { setWhere: lt(pendingScans.enqueued_at, options.staleBefore) }),
    })
    .returning({ seq: pendingScans.seq });
  return put[0]?.seq ?? null;
}

/** What a consumer finds when it asks for a key's job. */
export type Claim =
  | { readonly state: 'claimed'; readonly claim: ClaimedScan }
  /** Another consumer is running it and its lease is fresh: try again later. */
  | { readonly state: 'busy' }
  /** A consumer finished it already (a newer message ran it): nothing to do. */
  | { readonly state: 'gone' };

/**
 * Take the job of `key`: a job that nobody holds, or whose holder's lease is
 * older than `staleBefore`, is claimed at `now`.
 */
export async function claimPending(
  db: Database,
  key: string,
  now: string,
  staleBefore: string,
): Promise<Claim> {
  const taken = await db
    .update(pendingScans)
    .set({ claimed_at: now })
    .where(
      and(
        eq(pendingScans.key, key),
        or(
          isNull(pendingScans.claimed_at),
          lt(pendingScans.claimed_at, staleBefore),
        ),
      ),
    )
    .returning({ seq: pendingScans.seq, job: pendingScans.job });
  const row = taken[0];
  if (row) {
    return { state: 'claimed', claim: row };
  }
  const [held] = await db
    .select({ key: pendingScans.key })
    .from(pendingScans)
    .where(eq(pendingScans.key, key));
  return { state: held ? 'busy' : 'gone' };
}

/** Forget a job that was done; a newer job under the same key (another `seq`) stays. */
export async function finishPending(
  db: Database,
  key: string,
  seq: number,
): Promise<void> {
  await db
    .delete(pendingScans)
    .where(and(eq(pendingScans.key, key), eq(pendingScans.seq, seq)));
}

/** Give up the lease on a job that failed, so its retry may take it at once. */
export async function releasePending(
  db: Database,
  key: string,
  seq: number,
): Promise<void> {
  await db
    .update(pendingScans)
    .set({ claimed_at: null })
    .where(and(eq(pendingScans.key, key), eq(pendingScans.seq, seq)));
}

/**
 * Find the jobs that have waited since before `staleBefore` (their messages
 * were lost, or dead-lettered after every retry) and mark them as sent again at
 * `now`, so the next sweep leaves them alone for a while. The caller sends a
 * message for each. Oldest first, at most `limit`.
 */
export async function revivePending(
  db: Database,
  staleBefore: string,
  now: string,
  limit: number,
): Promise<{ key: string; seq: number }[]> {
  return db
    .update(pendingScans)
    .set({ enqueued_at: now })
    .where(
      inArray(
        pendingScans.key,
        db
          .select({ key: pendingScans.key })
          .from(pendingScans)
          .where(lt(pendingScans.enqueued_at, staleBefore))
          .orderBy(asc(pendingScans.enqueued_at))
          .limit(limit),
      ),
    )
    .returning({ key: pendingScans.key, seq: pendingScans.seq });
}
