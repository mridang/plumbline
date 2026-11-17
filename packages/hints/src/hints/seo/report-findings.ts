import { toSeverity } from './to-severity.js';
import type { ReportOptions } from 'hint';
import type { Page } from '../../core/page.js';
import type { Finding } from '../../lib/headers/finding.js';

/**
 * Reports each finding of a pure rule against the page, keeping the severity
 * the rule chose. `options` adds the element or snippet shown with the finding.
 */
export function reportFindings(
  page: Page,
  findings: readonly Finding[],
  options: Partial<ReportOptions> = {},
): void {
  // eslint-disable-next-line functional/no-loop-statements -- reports each finding
  for (const found of findings) {
    page.report(found.message, {
      ...options,
      severity: toSeverity(found.severity),
    });
  }
}
