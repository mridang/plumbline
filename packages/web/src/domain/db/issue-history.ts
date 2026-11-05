/**
 * @packageDocumentation
 *
 * The issues the app opened on GitHub for a site, kept for good (see
 * `suite.ts`, which only keeps the latest one of a site). One row per issue
 * number: when it was opened, how it stands and which checks it reported, so
 * the results can say under a check which issues report it.
 */

import { and, desc, eq, notInArray } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { suiteIssueHistory } from '@/domain/db/schema';

/**
 * How an issue stands: open, closed by the app, closed by a person, gone from
 * GitHub, or replaced (an issue of the old kind, one per site, closed when the
 * site got one issue per check).
 */
export type IssueHistoryState =
  'open' | 'fixed' | 'dismissed' | 'deleted' | 'replaced';

/** The states whose issues are not listed. */
const NOT_LISTED: IssueHistoryState[] = ['deleted', 'replaced'];

/** One issue of a site. */
export interface IssueRef {
  readonly number: number;
  readonly state: 'open' | 'fixed' | 'dismissed';
  /** When the app opened it (RFC 3339). */
  readonly opened_at: string;
  /** The ids of the checks it reports: the one check it tracks. */
  readonly checks: readonly string[];
}

/** The most issues of one site that are listed. */
export const ISSUES_LISTED = 50;

/** A stored list of check ids, or none when it is not a list of strings. */
function checksOf(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

/**
 * Records the issue that tracks one check of a site: the first time adds it
 * (opened now), a later one updates how it stands. A claim that is not an issue
 * yet (number 0) is not recorded.
 */
export async function recordIssue(
  db: Database,
  repo: string,
  host: string,
  check: string,
  issue: Readonly<{ number: number; state: string }>,
  now = new Date(),
): Promise<void> {
  if (issue.number <= 0 || issue.state === 'opening') {
    return;
  }
  await db
    .insert(suiteIssueHistory)
    .values({
      repo,
      host,
      number: issue.number,
      state: issue.state,
      opened_at: now.toISOString(),
      checks: JSON.stringify([check]),
      check_id: check,
    })
    .onConflictDoUpdate({
      target: [
        suiteIssueHistory.repo,
        suiteIssueHistory.host,
        suiteIssueHistory.number,
      ],
      set: { state: issue.state },
    });
}

/** Marks an issue of the old kind (one per site) as replaced; its row stays but is not listed. */
export async function markIssueReplaced(
  db: Database,
  repo: string,
  number: number,
): Promise<void> {
  await db
    .update(suiteIssueHistory)
    .set({ state: 'replaced' })
    .where(
      and(
        eq(suiteIssueHistory.repo, repo),
        eq(suiteIssueHistory.number, number),
      ),
    );
}

/** Marks an issue of a repository as gone from GitHub; its row stays. */
export async function markIssueDeleted(
  db: Database,
  repo: string,
  number: number,
): Promise<void> {
  await db
    .update(suiteIssueHistory)
    .set({ state: 'deleted' })
    .where(
      and(
        eq(suiteIssueHistory.repo, repo),
        eq(suiteIssueHistory.number, number),
      ),
    );
}

/** The issues of a site, newest first, without the ones deleted on GitHub or replaced. */
export async function issuesOf(
  db: Database,
  repo: string,
  host: string,
): Promise<IssueRef[]> {
  const rows = await db
    .select({
      number: suiteIssueHistory.number,
      state: suiteIssueHistory.state,
      opened_at: suiteIssueHistory.opened_at,
      checks: suiteIssueHistory.checks,
      check_id: suiteIssueHistory.check_id,
    })
    .from(suiteIssueHistory)
    .where(
      and(
        eq(suiteIssueHistory.repo, repo),
        eq(suiteIssueHistory.host, host),
        notInArray(suiteIssueHistory.state, NOT_LISTED),
      ),
    )
    .orderBy(desc(suiteIssueHistory.opened_at), desc(suiteIssueHistory.number))
    .limit(ISSUES_LISTED);
  return rows.map((row) => ({
    number: row.number,
    state:
      row.state === 'fixed' || row.state === 'dismissed' ? row.state : 'open',
    opened_at: row.opened_at,
    // An issue of the old kind (no check of its own) reported several.
    checks: row.check_id === '' ? checksOf(row.checks) : [row.check_id],
  }));
}
