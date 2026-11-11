/**
 * @packageDocumentation
 *
 * One server-side run of a site: the scanner container scans it, and the
 * outcomes of its checks become what the suite stores and reports.
 */

import { parseReportInput } from '@/domain/api/report-resource';
import type { ReportCounts } from '@/domain/db/reports';
import { checksOf, skippedOf, type CheckResult } from '@/domain/suite/checks';
import type { ScanResult } from '@/domain/suite/scanner';

/** The largest outcomes JSON kept with a run; a bigger one is left out. */
export const MAX_KEPT_OUTCOMES_BYTES = 900_000;

/** The outcome of one run. */
export interface SuiteRun {
  /** The address the page was finally served from. */
  readonly url: string;
  readonly status: number;
  /** SHA-256 of what the run found, to tell whether the next run found the same. */
  readonly hash: string;
  /** What the checks that ran found. */
  readonly checks: readonly CheckResult[];
  /** The ids of the checks that could not run, whose previous findings still stand. */
  readonly skipped: readonly string[];
  /** How many checks ended each way. */
  readonly counts?: ReportCounts;
  /** Every check's outcome as JSON, to open the run as a report; null when too large or unreadable. */
  readonly outcomes?: string | null;
  /** Each check's id and how it ended, so the figures can be worked out again for fewer checks. */
  readonly statuses?: readonly CheckStatus[];
}

/** How one check ended. */
export interface CheckStatus {
  readonly id: string;
  readonly status: ScanResult['outcomes'][number]['status'];
}

/** How many of the checks ended each way. */
export function countsOf(outcomes: readonly CheckStatus[]): ReportCounts {
  const count = (status: CheckStatus['status']): number =>
    outcomes.filter((outcome) => outcome.status === status).length;
  return {
    passed: count('passed'),
    warned: count('warned'),
    failed: count('failed'),
    skipped: count('skipped'),
  };
}

/**
 * The outcomes of a scan as a saved report would hold them (the same checking
 * and trimming a posted report gets), or null when they are not a valid report
 * or are too large to keep with the run.
 */
export function keptOutcomes(scan: Readonly<ScanResult>): string | null {
  const parsed = parseReportInput(
    { url: scan.finalUrl, outcomes: scan.raw },
    new URL(scan.finalUrl).hostname,
  );
  if (!parsed.ok) {
    return null;
  }
  const text = JSON.stringify(parsed.value.outcomes);
  return text.length <= MAX_KEPT_OUTCOMES_BYTES ? text : null;
}

/** Whether an outcome has an id that `keep` allows. */
function hasKeptId(outcome: unknown, keep: ReadonlySet<string>): boolean {
  if (typeof outcome !== 'object' || outcome === null || !('id' in outcome)) {
    return false;
  }
  return typeof outcome.id === 'string' && keep.has(outcome.id);
}

/** The ids in a stored outcomes JSON that `keep` allows; the text as it was when it cannot be read. */
function restrictedOutcomes(text: string, keep: ReadonlySet<string>): string {
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed)
      ? JSON.stringify(
          parsed.filter((outcome: unknown) => hasKeptId(outcome, keep)),
        )
      : text;
  } catch {
    return text;
  }
}

/**
 * The run as the rules see it: only the checks in `enabled` keep their outcome
 * and count. The scanner runs every check of the catalogue, so without this a
 * site would read as failing checks its rules never asked for. A run that
 * lists no statuses (one made by hand elsewhere) is returned as it is.
 */
export function restrictRun(
  run: Readonly<SuiteRun>,
  enabled: ReadonlySet<string>,
): SuiteRun {
  if (run.statuses === undefined) {
    return run;
  }
  const statuses = run.statuses.filter((entry) => enabled.has(entry.id));
  return {
    ...run,
    statuses,
    counts: countsOf(statuses),
    outcomes:
      run.outcomes === undefined || run.outcomes === null
        ? run.outcomes
        : restrictedOutcomes(run.outcomes, enabled),
  };
}

/** The SHA-256 of `text` as hex, computed natively by the runtime. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * The run a scan came to. Throws when no check ran at all: a scan where
 * everything was skipped found nothing out, and must not read as a clean site
 * (it would close the issue of a site that has problems).
 */
export async function suiteRunOf(
  scan: Readonly<ScanResult>,
): Promise<SuiteRun> {
  const checks = checksOf(scan.outcomes);
  if (checks.length === 0) {
    throw new Error('The scanner ran no checks.');
  }
  const found = checks
    .toSorted((a, b) => (a.id < b.id ? -1 : 1))
    .map((check) => [check.id, check.findings]);
  return {
    url: scan.finalUrl,
    status: scan.status,
    hash: await sha256Hex(`${scan.status}\n${JSON.stringify(found)}`),
    checks,
    skipped: skippedOf(scan.outcomes),
    counts: countsOf(scan.outcomes),
    outcomes: keptOutcomes(scan),
    statuses: scan.outcomes.map(({ id, status }) => ({ id, status })),
  };
}
