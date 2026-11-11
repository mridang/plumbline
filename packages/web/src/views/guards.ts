/**
 * @packageDocumentation
 *
 * The shapes of this app's `structuredContent`, checked before a View draws
 * them: the payload is untrusted input, so a View never trusts a cast. The
 * reading of a result around these guards is shared (`payload.ts`).
 */

import type { DomainListData, ReportData } from '@/domain/mcp/ui-types';
import { everyEntry, isRecord, isString } from '@/views/payload';

/** Whether the value is a whole number of at least zero. */
function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Whether the record's four count fields are all counts. */
function hasCounts(value: Readonly<Record<string, unknown>>): boolean {
  return (
    isCount(value['passed']) &&
    isCount(value['warned']) &&
    isCount(value['failed']) &&
    isCount(value['skipped'])
  );
}

/** Whether the value carries the four counts of a report. */
function isTally(value: unknown): boolean {
  return isRecord(value) && hasCounts(value);
}

/** Whether the value is absent or a string. */
function isOptionalString(value: unknown): boolean {
  return value === undefined || isString(value);
}

/** Whether the value is a problem status the report can show. */
function isProblemStatus(value: unknown): boolean {
  return value === 'failed' || value === 'warned';
}

/** Whether the record has the text fields of a report. */
function hasReportText(value: Readonly<Record<string, unknown>>): boolean {
  return (
    isString(value['host']) &&
    isString(value['url']) &&
    isString(value['created_at']) &&
    isString(value['link'])
  );
}

/** Whether the value is a finding: a message and the resource it concerns. */
function isFinding(value: unknown): boolean {
  return (
    isRecord(value) && isString(value['message']) && isString(value['resource'])
  );
}

/** Whether the record has the id, name and optional fields of a problem. */
function hasProblemText(value: Readonly<Record<string, unknown>>): boolean {
  return (
    isString(value['id']) &&
    isString(value['name']) &&
    isOptionalString(value['fixer']) &&
    isOptionalString(value['reference'])
  );
}

/** Whether the value is a problem the report lists, with its findings. */
function isProblem(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasProblemText(value) &&
    isProblemStatus(value['status']) &&
    everyEntry(value['findings'], isFinding)
  );
}

/** Whether the value has the shape of the report's `structuredContent`. */
export function isReportData(value: unknown): value is ReportData {
  return (
    isRecord(value) &&
    isTally(value) &&
    hasReportText(value) &&
    everyEntry(value['problems'], isProblem)
  );
}

/** Whether the record has the id, host and check count of a domain. */
function hasDomainFields(value: Readonly<Record<string, unknown>>): boolean {
  return (
    isString(value['id']) && isString(value['host']) && isCount(value['checks'])
  );
}

/** Whether the value is a domain the list shows, with its latest tally. */
function isDomain(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasDomainFields(value) &&
    (value['latest'] === undefined || isTally(value['latest']))
  );
}

/** Whether the value has the shape of the domain list's `structuredContent`. */
export function isDomainListData(value: unknown): value is DomainListData {
  return (
    isRecord(value) &&
    isCount(value['total_checks']) &&
    isString(value['link']) &&
    everyEntry(value['domains'], isDomain)
  );
}
