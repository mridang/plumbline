/**
 * @packageDocumentation
 *
 * Repository for the server-side runs: each run of a host and the webhook
 * deliveries already handled. Every read is scoped by the owner.
 */

import { and, desc, eq, lt, notInArray } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { suiteRuns, webhookDeliveries } from '@/domain/db/schema';
import type { StoredFinding } from '@/domain/suite/diff';

/** How many runs are kept for each host. */
export const RUNS_KEPT = 20;

/** How long a delivery id is remembered, in milliseconds. */
const DELIVERY_MEMORY_MS = 7 * 24 * 60 * 60 * 1000;

/** A stored run, with its findings read out of the JSON column. */
export interface StoredRun {
  readonly id: number;
  readonly host: string;
  readonly repo: string | null;
  readonly sha: string | null;
  readonly status: number;
  readonly ran_at: string;
  readonly findings: readonly StoredFinding[];
}

/** The findings in a stored JSON array (anything unreadable counts as none). */
function findingsIn(text: string): readonly StoredFinding[] {
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) ? (value as StoredFinding[]) : [];
  } catch {
    return [];
  }
}

/** Store a run, and drop the oldest runs of the host beyond `RUNS_KEPT`. */
export async function recordRun(
  db: Database,
  run: Readonly<{
    userId: number;
    host: string;
    repo: string | null;
    sha: string | null;
    status: number;
    findings: readonly StoredFinding[];
  }>,
  timestamp = new Date().toISOString(),
): Promise<void> {
  await db.insert(suiteRuns).values({
    user_id: run.userId,
    host: run.host,
    repo: run.repo,
    sha: run.sha,
    status: run.status,
    ran_at: timestamp,
    findings: JSON.stringify(run.findings),
  });
  const kept = await db
    .select({ id: suiteRuns.id })
    .from(suiteRuns)
    .where(and(eq(suiteRuns.user_id, run.userId), eq(suiteRuns.host, run.host)))
    .orderBy(desc(suiteRuns.id))
    .limit(RUNS_KEPT);
  await db.delete(suiteRuns).where(
    and(
      eq(suiteRuns.user_id, run.userId),
      eq(suiteRuns.host, run.host),
      notInArray(
        suiteRuns.id,
        kept.map((row) => row.id),
      ),
    ),
  );
}

/** The latest runs of the person's host, newest first. */
export async function latestRuns(
  db: Database,
  userId: number,
  host: string,
  limit = 2,
): Promise<StoredRun[]> {
  const rows = await db
    .select()
    .from(suiteRuns)
    .where(and(eq(suiteRuns.user_id, userId), eq(suiteRuns.host, host)))
    .orderBy(desc(suiteRuns.id))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    host: row.host,
    repo: row.repo,
    sha: row.sha,
    status: row.status,
    ran_at: row.ran_at,
    findings: findingsIn(row.findings),
  }));
}

/**
 * Remember a delivery id. False when it was already remembered, which means
 * GitHub sent the delivery again. Ids older than a week are forgotten.
 */
export async function claimDelivery(
  db: Database,
  deliveryId: string,
  now = new Date(),
): Promise<boolean> {
  await db
    .delete(webhookDeliveries)
    .where(
      lt(
        webhookDeliveries.received_at,
        new Date(now.getTime() - DELIVERY_MEMORY_MS).toISOString(),
      ),
    );
  const claimed = await db
    .insert(webhookDeliveries)
    .values({ delivery_id: deliveryId, received_at: now.toISOString() })
    .onConflictDoNothing()
    .returning({ id: webhookDeliveries.delivery_id });
  return claimed.length > 0;
}
