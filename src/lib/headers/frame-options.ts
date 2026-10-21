/**
 * X-Frame-Options analysis.
 *
 * Observatory (`tests/x-frame-options.js`) and Webbkoll accept `DENY` and
 * `SAMEORIGIN`, accept `ALLOW-FROM` with a recommendation to use CSP, and
 * treat a CSP `frame-ancestors` directive as an equivalent that makes the
 * header unnecessary. The OWASP profile requires exactly `deny`.
 */
import { finding, type Finding, type Profile } from './finding.js';

export interface FrameOptionsInput {
  header: string | null;
  /** True when the CSP header contains a `frame-ancestors` directive. */
  cspFrameAncestors: boolean;
  profile: Profile;
}

export function frameOptionsFindings({
  header,
  cspFrameAncestors,
  profile,
}: FrameOptionsInput): Finding[] {
  if (profile === 'owasp') {
    if (header === null) {
      return [
        finding('error', "The 'X-Frame-Options' header was not specified."),
      ];
    }
    return header.trim().toLowerCase() === 'deny'
      ? []
      : [finding('error', "The 'X-Frame-Options' header should be 'deny'.")];
  }

  // frame-ancestors supersedes X-Frame-Options in every modern browser.
  if (cspFrameAncestors) {
    return [];
  }
  if (header === null) {
    return [
      finding(
        'error',
        'X-Frame-Options (XFO) header not implemented. Implement frame-ancestors CSP.',
      ),
    ];
  }
  const xfo = header.slice(0, 1024).trim().toLowerCase();
  if (xfo === 'deny' || xfo === 'sameorigin') {
    return [];
  }
  if (xfo.startsWith('allow-from')) {
    return [
      finding(
        'hint',
        'X-Frame-Options (XFO) header uses ALLOW-FROM uri directive, which browsers no longer support. Implement frame-ancestors CSP.',
      ),
    ];
  }
  return [
    finding(
      'error',
      'X-Frame-Options (XFO) header cannot be recognized. Implement frame-ancestors CSP.',
    ),
  ];
}
