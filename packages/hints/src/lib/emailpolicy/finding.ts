/**
 * The shape the pure email-policy validators return. The library holds no
 * webhint types (so it is testable without a scan), so a finding carries a
 * plain severity string that the hint maps onto webhint's `Severity` enum.
 */

/** How serious a finding is, mirroring webhint's three report levels. */
type FindingSeverity = 'error' | 'warning' | 'hint';

/** One problem a validator found, ready for the hint to report. */
export interface Finding {
  /** The message shown to the user, stated as the problem. */
  message: string;
  severity: FindingSeverity;
  /** Evidence for the report (the record, the policy line, an example). */
  codeSnippet?: string;
}
