/**
 * @packageDocumentation
 *
 * Reports on the wire: the representation `/api/domains/{id}/reports` sends,
 * and checking the outcome a browser posts once a scan has run. The browser
 * runs the checks, so the server cannot vouch for what it says; it only makes
 * sure the report is well formed, names real checks and is of a sane size.
 */

import { findCheck, isCheckId } from '@/domain/checks/catalogue';
import { isObject } from '@/lib/core/api/json';
import { unknownFields } from '@/domain/api/domain-resource';
import type { Parsed } from '@/domain/api/domain-resource';
import type { Report, ReportCounts, ReportSummary } from '@/domain/db/reports';

/** An http or https address. */
const HTTP_URL = /^https?:\/\//u;

/** A UUID in its lower-case text form. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

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

const LEVELS: readonly FindingLevel[] = [
  'error',
  'warning',
  'hint',
  'information',
];

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
  const raws: unknown[] = Array.isArray(value) ? value : [];
  return raws
    .flatMap((raw) => {
      if (!isObject(raw)) {
        return [];
      }
      const record = raw;
      const url = textOf(record['url']);
      const text = textOf(record['text']);
      return url !== undefined && HTTP_URL.test(url)
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
  if (!isObject(raw)) {
    return undefined;
  }
  const record = raw;
  const message = textOf(record['message']);
  const resource = textOf(record['resource']);
  if (message === undefined || resource === undefined) {
    return undefined;
  }
  const level = LEVELS.find((name) => name === record['level']);
  if (level === undefined) {
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
    level,
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
  if (!isObject(raw)) {
    return { ok: false, errors: [`${where}: must be an object.`] };
  }
  const record = raw;
  const id = record['id'];
  if (typeof id !== 'string' || !isCheckId(id)) {
    return { ok: false, errors: [`${where}.id: not a check.`] };
  }
  const status = STATUSES.find((name) => name === record['status']);
  if (status === undefined) {
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
    .map((finding) => findingOf(finding))
    .filter((f): f is StoredFinding => f !== undefined);
  const reason = textOf(record['reason']);
  return {
    ok: true,
    value: {
      id,
      status,
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
  const rawUrl = body['url'];
  const parsed =
    typeof rawUrl === 'string' && URL.canParse(rawUrl) ? new URL(rawUrl) : null;
  const sameSite =
    parsed !== null &&
    (parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  const urlErrors = ((): string[] => {
    if (typeof rawUrl !== 'string') {
      return ['url: required.'];
    }
    if (parsed === null) {
      return ['url: not a valid address.'];
    }
    return (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
      !sameSite
      ? [`url: must be an http or https address on ${host}.`]
      : [];
  })();
  const url = urlErrors.length === 0 ? parsed?.href : undefined;
  const rawOutcomes = body['outcomes'];
  const results = Array.isArray(rawOutcomes)
    ? rawOutcomes.map((raw, index) => outcomeOf(raw, index))
    : [];
  const firstIndexOf = (id: string): number =>
    results.findIndex((other) => other.ok && other.value.id === id);
  const outcomeErrors =
    Array.isArray(rawOutcomes) && rawOutcomes.length > 0
      ? results.flatMap((outcome, index) => {
          if (!outcome.ok) {
            return outcome.errors;
          }
          return firstIndexOf(outcome.value.id) < index
            ? [`outcomes[${index}].id: ${outcome.value.id} is listed twice.`]
            : [];
        })
      : ['outcomes: must be a list of at least one outcome.'];
  const outcomes = results.flatMap((outcome, index) =>
    outcome.ok && firstIndexOf(outcome.value.id) === index
      ? [outcome.value]
      : [],
  );
  const errors = [
    ...unknownFields(body, ['url', 'outcomes']),
    ...urlErrors,
    ...outcomeErrors,
  ];
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
  return outcomes.flatMap((outcome) => {
    const o = storedOutcomeOf(outcome);
    return o === undefined
      ? []
      : [{ ...o, name: findCheck(o.id)?.name ?? o.id }];
  });
}

/** The API's view of a stored report: each outcome with its check's name. */
export function reportResource(report: Readonly<Report>): ReportResource {
  const { outcomes, ...summary } = report;
  return { ...summary, outcomes: outcomeResources(outcomes) };
}

/** Whether a path segment can be a report id (the ids are UUIDs). */
export function isReportId(raw: string): boolean {
  return UUID.test(raw);
}
