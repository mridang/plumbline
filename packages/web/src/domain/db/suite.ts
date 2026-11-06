/**
 * @packageDocumentation
 *
 * Repository for the server-side runs: each run of a host and the webhook
 * deliveries already handled. Every read is scoped by the owner.
 */

import {
  and,
  asc,
  desc,
  eq,
  isNotNull,
  lt,
  lte,
  notInArray,
} from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import {
  markIssueDeleted,
  markIssueReplaced,
  recordIssue,
} from '@/domain/db/issue-history';
import {
  disabledRepos,
  domains,
  suiteCheckIssues,
  suiteIssues,
  suiteRuns,
  webhookDeliveries,
} from '@/domain/db/schema';
import type { ReportCounts } from '@/domain/db/reports';
import type { StoredFinding } from '@/domain/suite/diff';

/** How a server run started. */
export type SuiteRunKind = 'deployment' | 'scheduled' | 'config';

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
  /** The page's validators, as the site gave them. */
  readonly etag: string | null;
  readonly last_modified: string | null;
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
    /** How the run started; a deployment when not said. */
    kind?: SuiteRunKind;
    /** How many checks ended each way. */
    counts?: ReportCounts | null;
    /** Every check's outcome as JSON, to open the run as a report. */
    outcomes?: string | null;
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
    kind: run.kind ?? 'deployment',
    passed: run.counts?.passed ?? null,
    warned: run.counts?.warned ?? null,
    failed: run.counts?.failed ?? null,
    skipped: run.counts?.skipped ?? null,
    outcomes: run.outcomes ?? null,
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
  // Without the outcomes, which can be large and are not needed to compare runs.
  const rows = await db
    .select({
      id: suiteRuns.id,
      host: suiteRuns.host,
      repo: suiteRuns.repo,
      sha: suiteRuns.sha,
      status: suiteRuns.status,
      hash: suiteRuns.hash,
      rules: suiteRuns.rules,
      ran_at: suiteRuns.ran_at,
      findings: suiteRuns.findings,
      etag: suiteRuns.etag,
      last_modified: suiteRuns.last_modified,
    })
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
    .where(
      and(
        isNotNull(domains.repo),
        lt(domains.checked_at, cutoff),
        // A repository whose checks are off is never re-checked.
        notInArray(
          domains.repo,
          db.select({ repo: disabledRepos.repo }).from(disabledRepos),
        ),
      ),
    )
    .orderBy(asc(domains.checked_at), asc(domains.host), asc(domains.user_id))
    .limit(limit);
}

/**
 * Notes that a site was tried at `at` and did not answer, so the scheduled
 * re-check waits its turn instead of trying it again every ten minutes (a few
 * sites that are down would otherwise fill every batch).
 */
export async function markTried(
  db: Database,
  userId: number,
  host: string,
  at: string,
): Promise<void> {
  await db
    .update(domains)
    .set({ checked_at: at })
    .where(and(eq(domains.user_id, userId), eq(domains.host, host)));
}

/**
 * What became of the issue of a check: open, closed by the app (the problem is
 * gone or the rules no longer ask for the check), closed by a person while the
 * problem was still there, or claimed by a delivery that is opening it.
 */
export type IssueState = 'open' | 'fixed' | 'dismissed' | 'opening';

/** The issue that tracks one check of one host, when one was opened. */
export interface StoredIssue {
  readonly number: number;
  readonly state: IssueState;
  /** A fingerprint of the problems it last reported. */
  readonly signature: string;
  /** How often the app reopened it after a person closed it. */
  readonly reopens: number;
}

/** A stored issue with the host and the check it is about. */
export interface IssueOfCheck extends StoredIssue {
  readonly host: string;
  readonly check: string;
}

/** A stored row as an issue; a state it does not know counts as open. */
function toIssue(row: typeof suiteCheckIssues.$inferSelect): IssueOfCheck {
  const state =
    row.state === 'fixed' ||
    row.state === 'dismissed' ||
    row.state === 'opening'
      ? row.state
      : 'open';
  return {
    number: row.number,
    state,
    signature: row.signature,
    reopens: row.reopens,
    host: row.host,
    check: row.check_id,
  };
}

/** The issue that tracks one check of one host of a repository, if any. */
export async function issueOf(
  db: Database,
  repo: string,
  host: string,
  check: string,
): Promise<StoredIssue | undefined> {
  const [row] = await db
    .select()
    .from(suiteCheckIssues)
    .where(
      and(
        eq(suiteCheckIssues.repo, repo),
        eq(suiteCheckIssues.host, host),
        eq(suiteCheckIssues.check_id, check),
      ),
    );
  if (!row) {
    return undefined;
  }
  const found = toIssue(row);
  return {
    number: found.number,
    state: found.state,
    signature: found.signature,
    reopens: found.reopens,
  };
}

/** The issues of one host of a repository, whatever their state, by check. */
export async function issuesOfHost(
  db: Database,
  repo: string,
  host: string,
): Promise<Map<string, StoredIssue>> {
  const rows = await db
    .select()
    .from(suiteCheckIssues)
    .where(
      and(eq(suiteCheckIssues.repo, repo), eq(suiteCheckIssues.host, host)),
    );
  return new Map(rows.map((row) => [row.check_id, toIssue(row)]));
}

/** The issues of a repository that are open, with the host and check of each. */
export async function openIssuesOf(
  db: Database,
  repo: string,
): Promise<IssueOfCheck[]> {
  const rows = await db
    .select()
    .from(suiteCheckIssues)
    .where(
      and(eq(suiteCheckIssues.repo, repo), eq(suiteCheckIssues.state, 'open')),
    )
    .orderBy(asc(suiteCheckIssues.host), asc(suiteCheckIssues.check_id));
  return rows.map(toIssue);
}

/** The issue of a repository with this number, with the host and check it is about. */
export async function issueNumbered(
  db: Database,
  repo: string,
  number: number,
): Promise<IssueOfCheck | undefined> {
  const [row] = await db
    .select()
    .from(suiteCheckIssues)
    .where(
      and(eq(suiteCheckIssues.repo, repo), eq(suiteCheckIssues.number, number)),
    );
  return row && toIssue(row);
}

/**
 * Remember the issue that tracks a check of a host, replacing an earlier one
 * (the earlier one stays in the issue history).
 */
export async function saveIssue(
  db: Database,
  repo: string,
  host: string,
  check: string,
  issue: StoredIssue,
): Promise<void> {
  const values = {
    number: issue.number,
    state: issue.state,
    signature: issue.signature,
    reopens: issue.reopens,
  };
  await db
    .insert(suiteCheckIssues)
    .values({ repo, host, check_id: check, ...values })
    .onConflictDoUpdate({
      target: [
        suiteCheckIssues.repo,
        suiteCheckIssues.host,
        suiteCheckIssues.check_id,
      ],
      set: values,
    });
  await recordIssue(db, repo, host, check, issue);
}

/** Forget the issue of a repository with this number (it was deleted). */
export async function forgetIssue(
  db: Database,
  repo: string,
  number: number,
): Promise<void> {
  await db
    .delete(suiteCheckIssues)
    .where(
      and(eq(suiteCheckIssues.repo, repo), eq(suiteCheckIssues.number, number)),
    );
  await db
    .delete(suiteIssues)
    .where(and(eq(suiteIssues.repo, repo), eq(suiteIssues.number, number)));
  await markIssueDeleted(db, repo, number);
}

/** How long a claim to open an issue holds, in milliseconds, before a delivery that died is forgotten. */
export const CLAIM_MS = 2 * 60 * 1000;

/**
 * Claims the right to open the issue of a check of a host. True for the one
 * delivery that gets it; false when the check already has an issue, or another
 * delivery is opening it. A claim as old as {@link CLAIM_MS} or older was left
 * by a delivery that never finished and is taken over.
 */
export async function claimNewIssue(
  db: Database,
  repo: string,
  host: string,
  check: string,
  now = new Date(),
): Promise<boolean> {
  await db
    .delete(suiteCheckIssues)
    .where(
      and(
        eq(suiteCheckIssues.repo, repo),
        eq(suiteCheckIssues.host, host),
        eq(suiteCheckIssues.check_id, check),
        eq(suiteCheckIssues.state, 'opening'),
        lte(
          suiteCheckIssues.signature,
          new Date(now.getTime() - CLAIM_MS).toISOString(),
        ),
      ),
    );
  const claimed = await db
    .insert(suiteCheckIssues)
    .values({
      repo,
      host,
      check_id: check,
      number: 0,
      state: 'opening',
      signature: now.toISOString(),
    })
    .onConflictDoNothing()
    .returning({ number: suiteCheckIssues.number });
  return claimed.length > 0;
}

/** Gives up a claim to open an issue (opening it failed). */
export async function releaseIssueClaim(
  db: Database,
  repo: string,
  host: string,
  check: string,
): Promise<void> {
  await db
    .delete(suiteCheckIssues)
    .where(
      and(
        eq(suiteCheckIssues.repo, repo),
        eq(suiteCheckIssues.host, host),
        eq(suiteCheckIssues.check_id, check),
        eq(suiteCheckIssues.state, 'opening'),
      ),
    );
}

/** The issues of the old kind of a repository, one for each host that has one. */
export async function legacyIssuesOf(
  db: Database,
  repo: string,
): Promise<{ host: string; number: number; state: string }[]> {
  return db
    .select({
      host: suiteIssues.host,
      number: suiteIssues.number,
      state: suiteIssues.state,
    })
    .from(suiteIssues)
    .where(eq(suiteIssues.repo, repo));
}

/**
 * The issue of the old kind, one for all of a host's problems, if it has one.
 * Only the issues of the old kind are read here; each is closed and forgotten
 * the first time its host is checked under one issue per check.
 */
export async function legacyIssueOf(
  db: Database,
  repo: string,
  host: string,
): Promise<{ number: number; state: string } | undefined> {
  const [row] = await db
    .select({ number: suiteIssues.number, state: suiteIssues.state })
    .from(suiteIssues)
    .where(and(eq(suiteIssues.repo, repo), eq(suiteIssues.host, host)));
  return row;
}

/** Forgets the issue of the old kind of a host, and marks it replaced in the history. */
export async function retireLegacyIssue(
  db: Database,
  repo: string,
  host: string,
  number: number,
): Promise<void> {
  await db
    .delete(suiteIssues)
    .where(and(eq(suiteIssues.repo, repo), eq(suiteIssues.host, host)));
  await markIssueReplaced(db, repo, number);
}
