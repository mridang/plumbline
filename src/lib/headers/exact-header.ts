/**
 * Simple OWASP Secure Headers Project checks: a header that must be present
 * with exactly one value, and headers that must not be present at all.
 * Values are compared case-insensitively after trimming.
 */
import { finding, type Finding } from './finding.js';

/** The header must be sent, and be one of `allowed`. */
export function exactHeaderFindings(
  name: string,
  value: string | null,
  allowed: readonly string[],
): Finding[] {
  if (value === null) {
    return [finding('error', `The '${name}' header was not specified.`)];
  }
  if (allowed.includes(value.trim().toLowerCase())) {
    return [];
  }
  const shown = allowed.map((a) => `'${a}'`).join(' or ');
  return [finding('error', `The '${name}' header should be ${shown}.`)];
}

/** Reports a deprecated header that is still being sent. */
export function deprecatedHeaderFindings(
  name: string,
  value: string | null,
  reason: string,
): Finding[] {
  return value === null
    ? []
    : [
        finding(
          'error',
          `The '${name}' header is deprecated and should not be sent: ${reason}`,
        ),
      ];
}
