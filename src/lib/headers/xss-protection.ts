/**
 * X-XSS-Protection analysis.
 *
 * The header is deprecated: the OWASP Secure Headers Project says it should
 * not be sent, as it can introduce vulnerabilities in the browsers that
 * still honour it. Webbkoll's analysis (`x_xss_protection`) decides what the
 * value means (enabled, `mode=block`, disabled or invalid) and whether a
 * passing CSP makes it unnecessary; both are used to word the finding.
 */
import { finding, type Finding } from './finding.js';

export interface XssProtection {
  valid: boolean;
  enabled: boolean;
  modeBlock: boolean;
}

/** Webbkoll's `check_xxssp_directive`: `0|1` plus `mode=block`, `report=`. */
function parseDirectives(data: string): Map<string, string | null> | null {
  const valid = new Set(['0', '1', 'mode', 'report']);
  const result = new Map<string, string | null>();
  for (const part of data.split(';')) {
    const equals = part.indexOf('=');
    const key = (equals < 0 ? part : part.slice(0, equals)).trim();
    const value = equals < 0 ? null : part.slice(equals + 1).trim();
    if (
      !valid.has(key) ||
      (key === 'mode' && value !== 'block') ||
      result.has(key)
    ) {
      return null;
    }
    result.set(key, value);
  }
  return result;
}

/** Reads a header value the way Webbkoll does. */
export function parseXssProtection(header: string): XssProtection {
  const data = header.slice(0, 100).toLowerCase();
  const first = data.at(0);
  const startsValid = first === '0' || first === '1';
  const directives = parseDirectives(data);
  const valid = startsValid && directives !== null;
  return {
    valid,
    enabled: valid && first === '1',
    modeBlock: valid && directives?.get('mode') === 'block',
  };
}

/**
 * Findings for a present header. `cspPasses` tells whether the page has a
 * Content Security Policy Observatory counts as passing.
 */
export function xssProtectionFindings(
  header: string | null,
  cspPasses: boolean,
): Finding[] {
  if (header === null) {
    return [];
  }
  const parsed = parseXssProtection(header);
  const name = "The 'X-XSS-Protection' header";
  if (!parsed.valid) {
    return [
      finding(
        'error',
        `${name} cannot be recognized and is deprecated; it should not be sent.`,
      ),
    ];
  }
  const why = cspPasses
    ? 'it is not needed because a Content Security Policy is in place'
    : 'it only protects legacy browsers and can introduce vulnerabilities, use a Content Security Policy instead';
  if (!parsed.enabled) {
    // 0 switches the auditor off, which is the safe way to keep the header.
    return [
      finding(
        'warning',
        `${name} is deprecated and disables the browser's XSS filter; ${why}. Remove it.`,
      ),
    ];
  }
  return [
    finding('error', `${name} is deprecated and should not be sent: ${why}.`),
  ];
}
