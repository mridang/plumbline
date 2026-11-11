/**
 * @packageDocumentation
 *
 * Repository for the `reports` table: the saved outcome of each scan of a
 * domain. Scans run in the person's browser, which sends the outcome here once
 * every check has run. Only the newest {@link KEEP_REPORTS} of a domain are
 * kept; saving another removes the oldest. Every query is scoped by the owner.
 */

import { and, desc, eq, lt, or } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { reports } from '@/domain/db/schema';

/** A report row as stored (`outcomes` is still JSON text). */
type ReportRow = typeof reports.$inferSelect;

/** How many reports of one domain are kept. */
export const KEEP_REPORTS = 20;

/** How many checks ended each way. */
export interface ReportCounts {
  readonly passed: number;
  readonly warned: number;
  readonly failed: number;
  readonly skipped: number;
}

/** A report without its outcomes, for lists. */
export interface ReportSummary extends ReportCounts {
  readonly id: string;
  readonly domain_id: string;
  readonly url: string;
  readonly created_at: string;
}

/** A report with every check's outcome, as it was sent. */
export interface Report extends ReportSummary {
  readonly outcomes: readonly unknown[];
}

/** The summary of a row. */
function summaryOf(
  row: Readonly<Omit<ReportRow, 'outcomes' | 'sha'>>,
): ReportSummary {
  return {
    id: row.id,
    domain_id: row.domain_id,
    url: row.url,
    passed: row.passed,
    warned: row.warned,
    failed: row.failed,
    skipped: row.skipped,
    created_at: row.created_at,
  };
}

/** The outcomes in a row (anything unreadable counts as none). */
function outcomesOf(text: string): readonly unknown[] {
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/** The columns a list reads: everything but the outcomes, which can be large. */
const SUMMARY_COLUMNS = {
  id: reports.id,
  domain_id: reports.domain_id,
  user_id: reports.user_id,
  url: reports.url,
  passed: reports.passed,
  warned: reports.warned,
  failed: reports.failed,
  skipped: reports.skipped,
  created_at: reports.created_at,
};

/**
 * Save a report of one of the person's domains, then drop the domain's reports
 * beyond the newest {@link KEEP_REPORTS}.
 */
export async function saveReport(
  db: Database,
  userId: number,
  domainId: string,
  input: Readonly<ReportCounts & { url: string; outcomes: readonly unknown[] }>,
  /** The commit the repository was last known to be at, when known. */
  sha: string | null = null,
): Promise<Report> {
  const row = {
    id: crypto.randomUUID(),
    domain_id: domainId,
    user_id: userId,
    url: input.url,
    passed: input.passed,
    warned: input.warned,
    failed: input.failed,
    skipped: input.skipped,
    outcomes: JSON.stringify(input.outcomes),
    created_at: new Date().toISOString(),
    sha,
  };
  const inserted = db.insert(reports).values(row);
  await inserted;
  // The oldest report to keep, found through the index (one row read); only
  // what is older than it is deleted, so nothing else is read or sorted.
  const [oldestKept] = await db
    .select({ id: reports.id, created_at: reports.created_at })
    .from(reports)
    .where(eq(reports.domain_id, domainId))
    .orderBy(desc(reports.created_at), desc(reports.id))
    .limit(1)
    .offset(KEEP_REPORTS - 1);
  if (oldestKept) {
    await db
      .delete(reports)
      .where(
        and(
          eq(reports.domain_id, domainId),
          or(
            lt(reports.created_at, oldestKept.created_at),
            and(
              eq(reports.created_at, oldestKept.created_at),
              lt(reports.id, oldestKept.id),
            ),
          ),
        ),
      );
  }
  return { ...summaryOf(row), outcomes: input.outcomes };
}

/** Where a page of reports starts: after the report made at `created_at` with `id`. */
export interface ReportCursor {
  readonly created_at: string;
  readonly id: string;
}

/** A page of the domain's reports, newest first, starting after `after`. */
export async function listReports(
  db: Database,
  userId: number,
  domainId: string,
  limit: number,
  after?: Readonly<ReportCursor>,
): Promise<ReportSummary[]> {
  const scope = and(
    eq(reports.user_id, userId),
    eq(reports.domain_id, domainId),
  );
  const rows = await db
    .select(SUMMARY_COLUMNS)
    .from(reports)
    .where(
      after
        ? and(
            scope,
            or(
              lt(reports.created_at, after.created_at),
              and(
                eq(reports.created_at, after.created_at),
                lt(reports.id, after.id),
              ),
            ),
          )
        : scope,
    )
    .orderBy(desc(reports.created_at), desc(reports.id))
    .limit(limit);
  return rows.map((row) => summaryOf(row));
}

/** The domain's newest report with its outcomes, or undefined when it has none. */
export async function latestReport(
  db: Database,
  userId: number,
  domainId: string,
): Promise<Report | undefined> {
  const [row] = await db
    .select()
    .from(reports)
    .where(and(eq(reports.user_id, userId), eq(reports.domain_id, domainId)))
    .orderBy(desc(reports.created_at), desc(reports.id))
    .limit(1);
  return row
    ? { ...summaryOf(row), outcomes: outcomesOf(row.outcomes) }
    : undefined;
}

/** One report of the domain with its outcomes, or undefined. */
export async function getReport(
  db: Database,
  userId: number,
  domainId: string,
  id: string,
): Promise<Report | undefined> {
  const [row] = await db
    .select()
    .from(reports)
    .where(
      and(
        eq(reports.user_id, userId),
        eq(reports.domain_id, domainId),
        eq(reports.id, id),
      ),
    )
    .limit(1);
  return row
    ? { ...summaryOf(row), outcomes: outcomesOf(row.outcomes) }
    : undefined;
}

/** Remove every report of a domain (when the domain itself goes). */
export async function deleteReportsOf(
  db: Database,
  userId: number,
  domainId: string,
): Promise<void> {
  await db
    .delete(reports)
    .where(and(eq(reports.user_id, userId), eq(reports.domain_id, domainId)));
}
