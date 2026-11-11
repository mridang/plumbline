/**
 * @packageDocumentation
 *
 * Reports on the wire: the representation `/api/domains/{id}/reports` sends,
 * and checking the outcome a browser posts once a scan has run. The browser
 * runs the checks, so the server cannot vouch for what it says; it only makes
 * sure the report is well formed, names real checks and is of a sane size.
 */

import type { Report, ReportCounts, ReportSummary } from '@/domain/db/reports';
import { findCheck, isCheckId } from '@/domain/checks/catalogue';
import { unknownFields, type Parsed } from '@/domain/api/domain-resource';

/** How one check ended. */
export type OutcomeStatus = 'failed' | 'warned' | 'passed' | 'skipped';

const STATUSES: readonly OutcomeStatus[] = [
  'failed',
  'warned',
  'passed',
  'skipped',
];

/** How serious a finding is. */
type FindingLevel = 'error' | 'warning' | 'hint' | 'information';

const LEVELS: ReadonlySet<FindingLevel> = new Set([
  'error',
  'warning',
  'hint',
  'information',
]);

/** A page a finding points to for more on the problem or its fix. */
export interface StoredLink {
  readonly url: string;
  readonly text: string;
}

/** One thing a check found, as stored and sent. */
export interface StoredFinding {
  readonly resource: string;
  readonly message: string;
  readonly level: FindingLevel;
  readonly snippet?: string;
  readonly language?: string;
  readonly line?: number;
  readonly column?: number;
  readonly links?: readonly StoredLink[];
}

/** One check's outcome, as stored. */
export interface StoredOutcome {
  readonly id: string;
  readonly status: OutcomeStatus;
  readonly reason?: string;
  readonly findings: readonly StoredFinding[];
}

/** One check's outcome as the API shows it: the stored outcome plus the check's name. */
export interface OutcomeResource extends StoredOutcome {
  readonly name: string;
}

/** A report as a list shows it. */
export type ReportSummaryResource = ReportSummary;

/** A report with every outcome. */
export interface ReportResource extends ReportSummary {
  readonly outcomes: readonly OutcomeResource[];
}

/** The largest report body taken: every check with a few findings each fits easily. */
export const MAX_REPORT_BYTES = 1024 * 1024;

/** The most findings kept for one check; a page with thousands of the same fault says no more with all of them. */
export const MAX_FINDINGS = 50;

/** The longest piece of text kept from a finding. */
const MAX_TEXT = 2000;

/** A text field cut to {@link MAX_TEXT}, or undefined when absent or not text. */
function textOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value.slice(0, MAX_TEXT) : undefined;
}

/** The most further-reading links kept for one finding. */
const MAX_LINKS = 5;

/** A finding's further-reading links: plain http(s) ones only, at most {@link MAX_LINKS}. */
function linksOf(value: unknown): StoredLink[] {
  return (Array.isArray(value) ? (value as unknown[]) : [])
    .flatMap((raw) => {
      if (typeof raw !== 'object' || raw === null) {
        return [];
      }
      const record = raw as Readonly<Record<string, unknown>>;
      const url = textOf(record['url']);
      const text = textOf(record['text']);
      return url !== undefined && /^https?:\/\//.test(url)
        ? [{ url, text: text || url }]
        : [];
    })
    .slice(0, MAX_LINKS);
}

/** A whole number field, or undefined. */
function positionOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

/** A finding as stored, or undefined when it is not one. */
function findingOf(raw: unknown): StoredFinding | undefined {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const record = raw as Readonly<Record<string, unknown>>;
  const message = textOf(record['message']);
  const resource = textOf(record['resource']);
  const level = record['level'];
  if (
    message === undefined ||
    resource === undefined ||
    !LEVELS.has(level as FindingLevel)
  ) {
    return undefined;
  }
  const snippet = textOf(record['snippet']);
  const language = textOf(record['language']);
  const line = positionOf(record['line']);
  const column = positionOf(record['column']);
  const links = linksOf(record['links']);
  return {
    resource,
    message,
    level: level as FindingLevel,
    ...(snippet === undefined ? {} : { snippet }),
    ...(language === undefined ? {} : { language }),
    ...(line === undefined ? {} : { line }),
    ...(column === undefined ? {} : { column }),
    ...(links.length > 0 ? { links } : {}),
  };
}

/** One outcome as stored, or the reason it cannot be. */
function outcomeOf(raw: unknown, index: number): Parsed<StoredOutcome> {
  const where = `outcomes[${index}]`;
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: [`${where}: must be an object.`] };
  }
  const record = raw as Readonly<Record<string, unknown>>;
  const id = record['id'];
  if (typeof id !== 'string' || !isCheckId(id)) {
    return { ok: false, errors: [`${where}.id: not a check.`] };
  }
  const status = record['status'];
  if (!STATUSES.includes(status as OutcomeStatus)) {
    return {
      ok: false,
      errors: [`${where}.status: must be one of ${STATUSES.join(', ')}.`],
    };
  }
  const rawFindings = record['findings'] ?? [];
  if (!Array.isArray(rawFindings)) {
    return { ok: false, errors: [`${where}.findings: must be a list.`] };
  }
  const findings = rawFindings
    .slice(0, MAX_FINDINGS)
    .map(findingOf)
    .filter((f): f is StoredFinding => f !== undefined);
  const reason = textOf(record['reason']);
  return {
    ok: true,
    value: {
      id,
      status: status as OutcomeStatus,
      ...(reason === undefined ? {} : { reason }),
      findings,
    },
  };
}

/** What `POST /api/domains/{id}/reports` takes, once checked. */
export interface ReportInput extends ReportCounts {
  readonly url: string;
  readonly outcomes: readonly StoredOutcome[];
}

/**
 * Check a posted report: `url` (the address that was scanned, on the domain's
 * host) and `outcomes` (one per check, each check at most once). The counts are
 * worked out here from the statuses rather than taken from the client.
 */
export function parseReportInput(
  body: Readonly<Record<string, unknown>>,
  host: string,
): Parsed<ReportInput> {
  const errors: string[] = unknownFields(body, ['url', 'outcomes']);
  const rawUrl = body['url'];
  let url: string | undefined;
  if (typeof rawUrl === 'string') {
    try {
      const parsed = new URL(rawUrl);
      const sameSite =
        parsed.hostname === host || parsed.hostname.endsWith(`.${host}`);
      if (
        (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
        !sameSite
      ) {
        errors.push(`url: must be an http or https address on ${host}.`);
      } else {
        url = parsed.href;
      }
    } catch {
      errors.push('url: not a valid address.');
    }
  } else {
    errors.push('url: required.');
  }
  const rawOutcomes = body['outcomes'];
  const outcomes: StoredOutcome[] = [];
  if (!Array.isArray(rawOutcomes) || rawOutcomes.length === 0) {
    errors.push('outcomes: must be a list of at least one outcome.');
  } else {
    const seen = new Set<string>();
    rawOutcomes.forEach((raw, index) => {
      const outcome = outcomeOf(raw, index);
      if (!outcome.ok) {
        errors.push(...outcome.errors);
      } else if (seen.has(outcome.value.id)) {
        errors.push(
          `outcomes[${index}].id: ${outcome.value.id} is listed twice.`,
        );
      } else {
        seen.add(outcome.value.id);
        outcomes.push(outcome.value);
      }
    });
  }
  if (errors.length > 0 || url === undefined) {
    return { ok: false, errors: errors.slice(0, 20) };
  }
  const count = (status: OutcomeStatus) =>
    outcomes.filter((o) => o.status === status).length;
  return {
    ok: true,
    value: {
      url,
      outcomes,
      passed: count('passed'),
      warned: count('warned'),
      failed: count('failed'),
      skipped: count('skipped'),
    },
  };
}

/** A stored outcome read back, or undefined when the row holds something else. */
function storedOutcomeOf(raw: unknown): StoredOutcome | undefined {
  const parsed = outcomeOf(raw, 0);
  return parsed.ok ? parsed.value : undefined;
}

/** The API's view of stored outcomes: each with its check's name; anything else in the list is dropped. */
export function outcomeResources(
  outcomes: readonly unknown[],
): OutcomeResource[] {
  return outcomes
    .map(storedOutcomeOf)
    .filter((o): o is StoredOutcome => o !== undefined)
    .map((o) => ({ ...o, name: findCheck(o.id)?.name ?? o.id }));
}

/** The API's view of a stored report: each outcome with its check's name. */
export function reportResource(report: Readonly<Report>): ReportResource {
  const { outcomes, ...summary } = report;
  return { ...summary, outcomes: outcomeResources(outcomes) };
}

/** Whether a path segment can be a report id (the ids are UUIDs). */
export function isReportId(raw: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
    raw,
  );
}
