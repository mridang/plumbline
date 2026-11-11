/**
 * Helpers shared by the `secplus` hints: the severity mapping and a small
 * reporter for findings that point at a DOM element. Header-only hints in this
 * set reuse `../headers/shared.ts`'s `reportFindings`; the DOM hints
 * (`tabnabbing`, `form-action-secure`) need to attach the offending element,
 * so they use {@link reportElementFinding} here.
 */
import { Severity } from '@hint/utils-types';
import type { ReportOptions } from 'hint';
import type { Finding, FindingSeverity } from '../../lib/headers/finding.js';
import type { Page } from '../../core/page.js';

/** Maps a library {@link FindingSeverity} onto webhint's {@link Severity}. */
function toSeverity(severity: FindingSeverity): Severity {
  switch (severity) {
    case 'error': {
      return Severity.error;
    }
    case 'warning': {
      return Severity.warning;
    }
    case 'hint': {
      return Severity.hint;
    }
  }
}

/**
 * Reports one finding against a specific element of the page. Webhint derives
 * the line, column and code snippet from the element itself, so no snippet is
 * passed. A null element falls back to a page-level report.
 */
export function reportElementFinding(
  page: Page,
  found: Finding,
  element: ReportOptions['element'],
): void {
  page.report(found.message, {
    severity: toSeverity(found.severity),
    ...(element ? { element } : {}),
  });
}
