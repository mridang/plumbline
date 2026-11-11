/**
 * @packageDocumentation
 *
 * The history of a site: every run of its checks, whoever started it. A person
 * starts a run from the page (kept in `reports`, see `reports.ts`); the server
 * starts one when a deployment finishes, once a day, and when the rules in
 * `plumbline.yaml` change (kept in `suite_runs`, see `suite.ts`). The two are
 * listed together, newest first, one page at a time. Every read is scoped by
 * the owner.
 */

import { and, desc, eq, lt, or, sql } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { reports, suiteRuns } from '@/domain/db/schema';
import type { Report } from '@/domain/db/reports';
import type { SuiteRunKind } from '@/domain/db/suite';

/** How a run started: a person pressed "Run checks", or the server did. */
export type RunKind = 'manual' | SuiteRunKind;

/** One run in a list. A count is null for an older run that did not keep it. */
export interface RunSummary {
  /** A report's id as it is; a server run's id is `s` and its number. */
  readonly id: string;
  readonly kind: RunKind;
  readonly ran_at: string;
  /** The commit the run was for, when known. */
  readonly sha: string | null;
  readonly passed: number | null;
  readonly warned: number | null;
  readonly failed: number | null;
  readonly skipped: number | null;
  /** Whether the run keeps every check's outcome, so it can be opened. */
  readonly openable: boolean;
}

/** A run with every check's outcome. */
export interface Run extends RunSummary {
  /** The address that was checked. */
  readonly url: string;
  readonly outcomes: readonly unknown[];
}

/** The site a history is for. */
export interface Site {
  readonly domainId: string;
  readonly host: string;
}

/** Where a page of runs starts: after the run made at `ran_at` with `id`. */
export interface RunCursor {
  readonly ran_at: string;
  readonly id: string;
}

/** The id a server run is listed under. */
export function suiteRunId(id: number): string {
  return `s${id}`;
}

/** The number in a server run's listed id, or undefined when it is not one. */
export function suiteRunNumber(id: string): number | undefined {
  return /^s[1-9]\d{0,15}$/.test(id) ? Number(id.slice(1)) : undefined;
}

/** The outcomes in stored JSON (anything unreadable counts as none). */
function outcomesIn(text: string | null): readonly unknown[] {
  if (text === null) {
    return [];
  }
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/** The kind a stored value stands for; one this code does not know reads as a deployment. */
function kindOf(value: string): SuiteRunKind {
  return value === 'scheduled' || value === 'config' ? value : 'deployment';
}

/** A list is in the order newest first, ties broken by id, descending. */
function newestFirst(a: RunSummary, b: RunSummary): number {
  if (a.ran_at !== b.ran_at) {
    // eslint-disable-next-line sonarjs/strings-comparison -- code-unit order on purpose: it must match the database ordering of ISO timestamps and ids, which localeCompare would not
    return a.ran_at < b.ran_at ? 1 : -1;
  }
  // eslint-disable-next-line sonarjs/strings-comparison -- code-unit order on purpose: it must match the database ordering of ISO timestamps and ids, which localeCompare would not
  if (a.id < b.id) {
    return 1;
  }
  // eslint-disable-next-line sonarjs/strings-comparison -- code-unit order on purpose: it must match the database ordering of ISO timestamps and ids, which localeCompare would not
  if (a.id > b.id) {
    return -1;
  }
  return 0;
}

/**
 * A page of the site's runs, newest first, starting after `after`: manual and
 * server runs together. Each source is asked for one page through its own
 * index and the two are merged, so no more than two pages are ever read. Two
 * runs made in the same millisecond by different sources are not told apart by
 * the cursor; the second source's is the one that may be skipped.
 */
export async function listRuns(
  db: Database,
  userId: number,
  site: Readonly<Site>,
  limit: number,
  after?: Readonly<RunCursor>,
): Promise<RunSummary[]> {
  const manualScope = and(
    eq(reports.user_id, userId),
    eq(reports.domain_id, site.domainId),
  );
  const serverScope = and(
    eq(suiteRuns.user_id, userId),
    eq(suiteRuns.host, site.host),
  );
  const afterNumber = after ? suiteRunNumber(after.id) : undefined;
  const manualPast = (cursor: Readonly<RunCursor>) => {
    if (afterNumber !== undefined) {
      return lt(reports.created_at, cursor.ran_at);
    }
    return or(
      lt(reports.created_at, cursor.ran_at),
      and(eq(reports.created_at, cursor.ran_at), lt(reports.id, cursor.id)),
    );
  };
  const serverPast = (cursor: Readonly<RunCursor>) => {
    if (afterNumber === undefined) {
      return lt(suiteRuns.ran_at, cursor.ran_at);
    }
    return or(
      lt(suiteRuns.ran_at, cursor.ran_at),
      and(eq(suiteRuns.ran_at, cursor.ran_at), lt(suiteRuns.id, afterNumber)),
    );
  };
  const manual = await db
    .select({
      id: reports.id,
      ran_at: reports.created_at,
      sha: reports.sha,
      passed: reports.passed,
      warned: reports.warned,
      failed: reports.failed,
      skipped: reports.skipped,
    })
    .from(reports)
    .where(after ? and(manualScope, manualPast(after)) : manualScope)
    .orderBy(desc(reports.created_at), desc(reports.id))
    .limit(limit);
  const server = await db
    .select({
      id: suiteRuns.id,
      kind: suiteRuns.kind,
      ran_at: suiteRuns.ran_at,
      sha: suiteRuns.sha,
      passed: suiteRuns.passed,
      warned: suiteRuns.warned,
      failed: suiteRuns.failed,
      skipped: suiteRuns.skipped,
      openable: sql<number>`${suiteRuns.outcomes} IS NOT NULL`,
    })
    .from(suiteRuns)
    .where(after ? and(serverScope, serverPast(after)) : serverScope)
    .orderBy(desc(suiteRuns.ran_at), desc(suiteRuns.id))
    .limit(limit);
  const runs: RunSummary[] = [
    ...manual.map((row): RunSummary => ({
      id: row.id,
      kind: 'manual',
      ran_at: row.ran_at,
      sha: row.sha,
      passed: row.passed,
      warned: row.warned,
      failed: row.failed,
      skipped: row.skipped,
      openable: true,
    })),
    ...server.map((row): RunSummary => ({
      id: suiteRunId(row.id),
      kind: kindOf(row.kind),
      ran_at: row.ran_at,
      sha: row.sha,
      passed: row.passed,
      warned: row.warned,
      failed: row.failed,
      skipped: row.skipped,
      openable: Boolean(row.openable),
    })),
  ];
  return runs.toSorted(newestFirst).slice(0, limit);
}

/** One run of the site with every check's outcome, or undefined when there is none (or it kept no outcomes). */
export async function getRun(
  db: Database,
  userId: number,
  site: Readonly<Site>,
  id: string,
): Promise<Run | undefined> {
  const number = suiteRunNumber(id);
  if (number === undefined) {
    const [row] = await db
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.user_id, userId),
          eq(reports.domain_id, site.domainId),
          eq(reports.id, id),
        ),
      )
      .limit(1);
    return row
      ? {
          id: row.id,
          kind: 'manual',
          ran_at: row.created_at,
          sha: row.sha,
          passed: row.passed,
          warned: row.warned,
          failed: row.failed,
          skipped: row.skipped,
          openable: true,
          url: row.url,
          outcomes: outcomesIn(row.outcomes),
        }
      : undefined;
  }
  const [row] = await db
    .select()
    .from(suiteRuns)
    .where(
      and(
        eq(suiteRuns.user_id, userId),
        eq(suiteRuns.host, site.host),
        eq(suiteRuns.id, number),
      ),
    )
    .limit(1);
  return row && row.outcomes !== null
    ? {
        id: suiteRunId(row.id),
        kind: kindOf(row.kind),
        ran_at: row.ran_at,
        sha: row.sha,
        passed: row.passed,
        warned: row.warned,
        failed: row.failed,
        skipped: row.skipped,
        openable: true,
        url: `https://${row.host}/`,
        outcomes: outcomesIn(row.outcomes),
      }
    : undefined;
}

/** When the person last ran the site's checks by hand, or undefined if they never have. */
export async function lastManualRunAt(
  db: Database,
  userId: number,
  domainId: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ created_at: reports.created_at })
    .from(reports)
    .where(and(eq(reports.user_id, userId), eq(reports.domain_id, domainId)))
    .orderBy(desc(reports.created_at), desc(reports.id))
    .limit(1);
  return row?.created_at;
}

/** How many of `outcomes` ended with each status, for a run that did not keep its counts. */
function countedIn(outcomes: readonly unknown[], status: string): number {
  return outcomes.filter(
    (outcome) =>
      typeof outcome === 'object' &&
      outcome !== null &&
      Reflect.get(outcome, 'status') === status,
  ).length;
}

/**
 * A run as a report, so it can be drawn like a saved one. A count the run did
 * not keep is counted from its outcomes.
 */
export function runAsReport(run: Readonly<Run>, domainId: string): Report {
  return {
    id: run.id,
    domain_id: domainId,
    url: run.url,
    passed: run.passed ?? countedIn(run.outcomes, 'passed'),
    warned: run.warned ?? countedIn(run.outcomes, 'warned'),
    failed: run.failed ?? countedIn(run.outcomes, 'failed'),
    skipped: run.skipped ?? countedIn(run.outcomes, 'skipped'),
    created_at: run.ran_at,
    outcomes: run.outcomes,
  };
}
