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

/** Whether the value carries the four counts of a report. */
function isTally(value: unknown): boolean {
  return (
    isRecord(value) &&
    isCount(value['passed']) &&
    isCount(value['warned']) &&
    isCount(value['failed']) &&
    isCount(value['skipped'])
  );
}

/** Whether the value has the shape of the report's `structuredContent`. */
export function isReportData(value: unknown): value is ReportData {
  return (
    isRecord(value) &&
    isTally(value) &&
    isString(value['host']) &&
    isString(value['url']) &&
    isString(value['created_at']) &&
    isString(value['link']) &&
    everyEntry(
      value['problems'],
      (entry) =>
        isRecord(entry) &&
        isString(entry['id']) &&
        isString(entry['name']) &&
        (entry['fixer'] === undefined || isString(entry['fixer'])) &&
        (entry['reference'] === undefined || isString(entry['reference'])) &&
        (entry['status'] === 'failed' || entry['status'] === 'warned') &&
        everyEntry(
          entry['findings'],
          (finding) =>
            isRecord(finding) &&
            isString(finding['message']) &&
            isString(finding['resource']),
        ),
    )
  );
}

/** Whether the value has the shape of the domain list's `structuredContent`. */
export function isDomainListData(value: unknown): value is DomainListData {
  return (
    isRecord(value) &&
    isCount(value['total_checks']) &&
    isString(value['link']) &&
    everyEntry(
      value['domains'],
      (entry) =>
        isRecord(entry) &&
        isString(entry['id']) &&
        isString(entry['host']) &&
        isCount(entry['checks']) &&
        (entry['latest'] === undefined || isTally(entry['latest'])),
    )
  );
}
