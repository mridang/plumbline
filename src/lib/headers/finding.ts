/**
 * Shared result shape of the header checks. The checks in this folder are
 * pure functions that return findings; the hints only turn them into
 * webhint reports.
 */

/** How serious a finding is; maps onto webhint's severities. */
export type FindingSeverity = 'error' | 'warning' | 'hint';

/** One problem (or piece of advice) found in a response. */
export interface Finding {
  message: string;
  severity: FindingSeverity;
}

/**
 * Which reference's rule set a hint applies. `observatory` is the lenient
 * Mozilla Observatory rule set, `owasp` is the stricter OWASP Secure
 * Headers Project value.
 */
export type Profile = 'observatory' | 'owasp';

/** Builds a finding. */
export function finding(severity: FindingSeverity, message: string): Finding {
  return { message, severity };
}
