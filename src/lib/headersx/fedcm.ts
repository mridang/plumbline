/**
 * `Set-Login` is the Federated Credential Management (FedCM) login-status
 * header. An identity provider sends it to tell the browser whether a user is
 * signed in, so a relying party's FedCM call can skip providers with no active
 * session. Follows the MDN reference page.
 */
import { finding, type Finding } from '../headers/finding.js';

/** The two values the FedCM login-status API defines. */
const VALUES = new Set(['logged-in', 'logged-out']);

/**
 * `Set-Login` must be exactly `logged-in` or `logged-out`; any other value is
 * reported because the browser ignores an unrecognised login status, leaving
 * the provider's session state stale.
 */
export function setLoginFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  if (!VALUES.has(value.trim().toLowerCase())) {
    return [
      finding(
        'warning',
        `The 'Set-Login' header must be 'logged-in' or 'logged-out', not '${value}'.`,
      ),
    ];
  }
  return [];
}
