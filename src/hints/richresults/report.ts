import { Severity } from '@hint/utils-types';
import type { Page } from '../../core/page.js';
import { readJsonLd, type JsonLdBlocks } from '../../lib/geo/json-ld.js';
import type { Finding } from '../../lib/headers/finding.js';

/** Maps a shared finding's severity onto webhint's. */
function toSeverity(finding: Finding): Severity {
  if (finding.severity === 'error') {
    return Severity.error;
  }
  if (finding.severity === 'warning') {
    return Severity.warning;
  }
  return Severity.hint;
}

/**
 * Runs one `richresults` check against the scanned page's JSON-LD and reports
 * each finding it returns. Every finding points at the first
 * `<script type="application/ld+json">` block (the node being validated lives
 * in the page's JSON-LD), falling back to `<head>` when there is none, so the
 * report has markup to highlight. The check decides the message and severity;
 * the hint only turns them into webhint reports, so the two surfaces share the
 * wording. A page with no node of the type yields no findings and nothing is
 * reported.
 */
export function reportRichResults(
  page: Page,
  check: (blocks: JsonLdBlocks) => Finding[],
): void {
  const blocks = readJsonLd(page.document);
  const element =
    page.document.querySelector('script[type="application/ld+json" i]') ??
    page.document.querySelector('head');
  for (const finding of check(blocks)) {
    page.report(finding.message, {
      severity: toSeverity(finding),
      element,
    });
  }
}
