/**
 * @packageDocumentation
 *
 * The issues the app opened on GitHub for a site, kept for good (see
 * `suite.ts`, which only keeps the latest one of a site). One row per issue
 * number: when it was opened, how it stands and which checks it reported, so
 * the results can say under a check which issues report it.
 */

import { and, desc, eq, ne } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { suiteIssueHistory } from '@/domain/db/schema';

/** How an issue stands: open, closed by the app, closed by a person, or gone from GitHub. */
export type IssueHistoryState = 'open' | 'fixed' | 'dismissed' | 'deleted';

/** One issue of a site. */
export interface IssueRef {
  readonly number: number;
  readonly state: Exclude<IssueHistoryState, 'deleted'>;
  /** When the app opened it (RFC 3339). */
  readonly opened_at: string;
  /** The ids of the checks it reported. */
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
 * Records an issue of a site: the first time adds it (opened now), a later one
 * updates how it stands and, when `checks` is given, which checks it reported.
 * A claim that is not an issue yet (number 0) is not recorded.
 */
export async function recordIssue(
  db: Database,
  repo: string,
  host: string,
  issue: Readonly<{ number: number; state: string }>,
  checks?: readonly string[],
  now = new Date(),
): Promise<void> {
  if (issue.number <= 0 || issue.state === 'opening') {
    return;
  }
  const json = JSON.stringify([...new Set(checks ?? [])]);
  await db
    .insert(suiteIssueHistory)
    .values({
      repo,
      host,
      number: issue.number,
      state: issue.state,
      opened_at: now.toISOString(),
      checks: json,
    })
    .onConflictDoUpdate({
      target: [
        suiteIssueHistory.repo,
        suiteIssueHistory.host,
        suiteIssueHistory.number,
      ],
      set: {
        state: issue.state,
        ...(checks === undefined ? {} : { checks: json }),
      },
    });
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

/** The issues of a site, newest first, without the ones deleted on GitHub. */
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
    })
    .from(suiteIssueHistory)
    .where(
      and(
        eq(suiteIssueHistory.repo, repo),
        eq(suiteIssueHistory.host, host),
        ne(suiteIssueHistory.state, 'deleted'),
      ),
    )
    .orderBy(desc(suiteIssueHistory.opened_at), desc(suiteIssueHistory.number))
    .limit(ISSUES_LISTED);
  return rows.map((row) => ({
    number: row.number,
    state:
      row.state === 'fixed' || row.state === 'dismissed' ? row.state : 'open',
    opened_at: row.opened_at,
    checks: checksOf(row.checks),
  }));
}
