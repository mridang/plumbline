/**
 * Permissions-Policy parsing and the OWASP Secure Headers Project check.
 *
 * OSHP expects the header to switch off 28 features with an empty allowlist
 * (`feature=()`). Any of them may also be limited to `(self)`: a site that
 * needs one of its own features (a copy button, voice input, fullscreen) keeps
 * it, and `(self)` still keeps embedded third parties from using it. An
 * allowlist that names other origins, or `*`, or is missing, still fails.
 */
import { finding, type Finding } from './finding.js';

/** Features that must be `()`, in the order OSHP lists them. */
export const DISABLED_FEATURES = [
  'accelerometer',
  'autoplay',
  'camera',
  'clipboard-read',
  'clipboard-write',
  'cross-origin-isolated',
  'display-capture',
  'encrypted-media',
  'fullscreen',
  'gamepad',
  'geolocation',
  'gyroscope',
  'hid',
  'idle-detection',
  'interest-cohort',
  'keyboard-map',
  'magnetometer',
  'microphone',
  'midi',
  'payment',
  'picture-in-picture',
  'publickey-credentials-get',
  'screen-wake-lock',
  'serial',
  'unload',
  'usb',
  'web-share',
  'xr-spatial-tracking',
] as const;

/** Splits on commas that are not inside parentheses or quotes. */
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = '';
  for (const char of value) {
    if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === '(') {
      depth++;
    } else if (!quoted && char === ')') {
      depth = Math.max(0, depth - 1);
    }
    if (char === ',' && depth === 0 && !quoted) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter((p) => p !== '');
}

/**
 * Parses the header into feature to allowlist. A parenthesised allowlist is
 * normalised to single spaces, so `( self )` and `(self)` compare equal;
 * parameters after the closing parenthesis are dropped.
 */
export function parsePermissionsPolicy(value: string): Map<string, string> {
  const policy = new Map<string, string>();
  for (const member of splitTopLevel(value)) {
    const equals = member.indexOf('=');
    if (equals === -1) {
      continue;
    }
    const feature = member.slice(0, equals).trim().toLowerCase();
    let allowlist = member.slice(equals + 1).trim();
    if (allowlist.startsWith('(')) {
      const close = allowlist.indexOf(')');
      const inner = allowlist.slice(1, close === -1 ? undefined : close);
      allowlist = `(${inner.trim().split(/\s+/).filter(Boolean).join(' ')})`;
    }
    if (!policy.has(feature)) {
      policy.set(feature, allowlist);
    }
  }
  return policy;
}

/** Whether an allowlist keeps a feature from third parties: empty, or this origin only. */
function isClosed(allowlist: string | undefined): boolean {
  return allowlist === '()' || allowlist === '(self)';
}

/** Findings for the OWASP rule; `value` is null when no header was sent. */
export function permissionsPolicyFindings(value: string | null): Finding[] {
  if (value === null) {
    return [
      finding('error', "The 'Permissions-Policy' header was not specified."),
    ];
  }
  const policy = parsePermissionsPolicy(value);
  const failing: string[] = DISABLED_FEATURES.filter(
    (feature) => !isClosed(policy.get(feature)),
  );
  if (!isClosed(policy.get('sync-xhr'))) {
    failing.push('sync-xhr');
  }
  if (failing.length === 0) {
    return [];
  }
  return [
    finding(
      'error',
      `The 'Permissions-Policy' header should disable these features with an empty allowlist (for example 'camera=()'), or limit them to this origin with '(self)': ${failing.join(', ')}.`,
    ),
  ];
}
