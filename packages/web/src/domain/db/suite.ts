/**
 * @packageDocumentation
 *
 * Repository for the server-side runs: each run of a host and the webhook
 * deliveries already handled. Every read is scoped by the owner.
 */

import { and, asc, desc, eq, isNotNull, lt, lte } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import {
  domains,
  suiteIssues,
  suiteRuns,
  webhookDeliveries,
} from '@/domain/db/schema';
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
  readonly hash: string | null;
  /** Fingerprint of the rules the run applied. */
  readonly rules: string | null;
  readonly ran_at: string;
  readonly findings: readonly StoredFinding[];
  /** The page's validators and the time it was fresh until, as the site gave them. */
  readonly etag: string | null;
  readonly last_modified: string | null;
  readonly fresh_until: string | null;
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
    hash: string;
    /** Fingerprint of the rules the run applied. */
    rules?: string | null;
    findings: readonly StoredFinding[];
    etag?: string | null;
    lastModified?: string | null;
    freshUntil?: string | null;
  }>,
  timestamp = new Date().toISOString(),
): Promise<void> {
  await db.insert(suiteRuns).values({
    user_id: run.userId,
    host: run.host,
    repo: run.repo,
    sha: run.sha,
    status: run.status,
    hash: run.hash,
    rules: run.rules ?? null,
    ran_at: timestamp,
    findings: JSON.stringify(run.findings),
    etag: run.etag ?? null,
    last_modified: run.lastModified ?? null,
    fresh_until: run.freshUntil ?? null,
  });
  // So the scheduled re-check can find the sites that are due without reading
  // every stored run.
  await db
    .update(domains)
    .set({ checked_at: timestamp })
    .where(and(eq(domains.user_id, run.userId), eq(domains.host, run.host)));
  // Runs are numbered in the order they were made, so the first run beyond
  // the ones kept is found by counting from the newest, and everything up to
  // it goes: one short walk down the index, not every run of the host.
  const [oldest] = await db
    .select({ id: suiteRuns.id })
    .from(suiteRuns)
    .where(and(eq(suiteRuns.user_id, run.userId), eq(suiteRuns.host, run.host)))
    .orderBy(desc(suiteRuns.id))
    .limit(1)
    .offset(RUNS_KEPT);
  if (oldest) {
    await db
      .delete(suiteRuns)
      .where(
        and(
          eq(suiteRuns.user_id, run.userId),
          eq(suiteRuns.host, run.host),
          lte(suiteRuns.id, oldest.id),
        ),
      );
  }
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
    hash: row.hash,
    rules: row.rules,
    ran_at: row.ran_at,
    findings: findingsIn(row.findings),
    etag: row.etag,
    last_modified: row.last_modified,
    fresh_until: row.fresh_until,
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

/** A site found through GitHub, with the person it belongs to. */
export interface DueSite {
  readonly user_id: number;
  readonly host: string;
  readonly repo: string | null;
}

/**
 * The sites found through GitHub (those with a repository) that were last
 * checked before `cutoff` or never, the longest-waiting first. It reads the
 * few rows it returns: each domain keeps the time of its last check, in an
 * index of just these sites.
 */
export async function dueSites(
  db: Database,
  cutoff: string,
  limit: number,
): Promise<DueSite[]> {
  return db
    .select({
      user_id: domains.user_id,
      host: domains.host,
      repo: domains.repo,
    })
    .from(domains)
    .where(and(isNotNull(domains.repo), lt(domains.checked_at, cutoff)))
    .orderBy(asc(domains.checked_at), asc(domains.host), asc(domains.user_id))
    .limit(limit);
}

/** What became of an issue: open, closed by the app because the problems were fixed, or closed by a person. */
export type IssueState = 'open' | 'fixed' | 'dismissed' | 'opening';

/** The issue that reports a host's problems, when one was opened. */
export interface StoredIssue {
  readonly number: number;
  readonly state: IssueState;
  /** A fingerprint of the problems it last reported. */
  readonly signature: string;
}

/** The issue that reports the problems of a host of a repository, if any. */
export async function issueOf(
  db: Database,
  repo: string,
  host: string,
): Promise<StoredIssue | undefined> {
  const [row] = await db
    .select()
    .from(suiteIssues)
    .where(and(eq(suiteIssues.repo, repo), eq(suiteIssues.host, host)));
  return row && toIssue(row);
}

/** The issue of a repository with this number, with the host it is about. */
export async function issueNumbered(
  db: Database,
  repo: string,
  number: number,
): Promise<(StoredIssue & { host: string }) | undefined> {
  const [row] = await db
    .select()
    .from(suiteIssues)
    .where(and(eq(suiteIssues.repo, repo), eq(suiteIssues.number, number)));
  return row && { ...toIssue(row), host: row.host };
}

/** A stored row as an issue; a state it does not know counts as open. */
function toIssue(row: typeof suiteIssues.$inferSelect): StoredIssue {
  const state =
    row.state === 'fixed' ||
    row.state === 'dismissed' ||
    row.state === 'opening'
      ? row.state
      : 'open';
  return { number: row.number, state, signature: row.signature };
}

/** Remember the issue that reports a host's problems, replacing an earlier one. */
export async function saveIssue(
  db: Database,
  repo: string,
  host: string,
  issue: StoredIssue,
): Promise<void> {
  const values = {
    number: issue.number,
    state: issue.state,
    signature: issue.signature,
  };
  await db
    .insert(suiteIssues)
    .values({ repo, host, ...values })
    .onConflictDoUpdate({
      target: [suiteIssues.repo, suiteIssues.host],
      set: values,
    });
}

/** Forget the issue of a repository with this number (it was deleted). */
export async function forgetIssue(
  db: Database,
  repo: string,
  number: number,
): Promise<void> {
  await db
    .delete(suiteIssues)
    .where(and(eq(suiteIssues.repo, repo), eq(suiteIssues.number, number)));
}

/** How long a claim to open an issue holds, in milliseconds, before a delivery that died is forgotten. */
export const CLAIM_MS = 2 * 60 * 1000;

/**
 * Claims the right to open the issue of a host of a repository. True for the
 * one delivery that gets it; false when the host already has an issue, or
 * another delivery is opening it. A claim as old as {@link CLAIM_MS} or older
 * was left by a delivery that never finished and is taken over.
 */
export async function claimNewIssue(
  db: Database,
  repo: string,
  host: string,
  now = new Date(),
): Promise<boolean> {
  await db
    .delete(suiteIssues)
    .where(
      and(
        eq(suiteIssues.repo, repo),
        eq(suiteIssues.host, host),
        eq(suiteIssues.state, 'opening'),
        lte(
          suiteIssues.signature,
          new Date(now.getTime() - CLAIM_MS).toISOString(),
        ),
      ),
    );
  const claimed = await db
    .insert(suiteIssues)
    .values({
      repo,
      host,
      number: 0,
      state: 'opening',
      signature: now.toISOString(),
    })
    .onConflictDoNothing()
    .returning({ number: suiteIssues.number });
  return claimed.length > 0;
}

/** Gives up a claim to open an issue (opening it failed). */
export async function releaseIssueClaim(
  db: Database,
  repo: string,
  host: string,
): Promise<void> {
  await db
    .delete(suiteIssues)
    .where(
      and(
        eq(suiteIssues.repo, repo),
        eq(suiteIssues.host, host),
        eq(suiteIssues.state, 'opening'),
      ),
    );
}
