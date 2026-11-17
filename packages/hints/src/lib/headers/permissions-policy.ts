/**
 * Permissions-Policy parsing and the OWASP Secure Headers Project check.
 *
 * OSHP expects the header to switch off 28 features with an empty allowlist
 * (`feature=()`). Any of them may also be limited to `(self)`: a site that
 * needs one of its own features (a copy button, voice input, fullscreen) keeps
 * it, and `(self)` still keeps embedded third parties from using it. An
 * allowlist that names other origins, or `*`, or is missing, still fails.
 */
import { finding } from './finding.js';
import type { Finding } from './finding.js';

/** Matches a run of whitespace. */
const WHITESPACE_RUN = /\s+/u;

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
  const scan = Array.from(value, (char) => char).reduce(
    (state, char) => {
      const quoted = char === '"' ? !state.quoted : state.quoted;
      const opens = !state.quoted && char === '(';
      const closes = !state.quoted && char === ')';
      const depth = Math.max(0, state.depth + Number(opens) - Number(closes));
      return char === ',' && depth === 0 && !quoted
        ? { parts: [...state.parts, state.current], current: '', depth, quoted }
        : {
            parts: state.parts,
            current: state.current + char,
            depth,
            quoted,
          };
    },
    { parts: [] as string[], current: '', depth: 0, quoted: false },
  );
  return [...scan.parts, scan.current].flatMap((part) => {
    const trimmed = part.trim();
    return trimmed === '' ? [] : [trimmed];
  });
}

/**
 * Parses the header into feature to allowlist. A parenthesised allowlist is
 * normalised to single spaces, so `( self )` and `(self)` compare equal;
 * parameters after the closing parenthesis are dropped.
 */
export function parsePermissionsPolicy(value: string): Map<string, string> {
  return new Map(
    splitTopLevel(value)
      .flatMap((member): [string, string][] => {
        const equals = member.indexOf('=');
        if (equals === -1) {
          return [];
        }
        const feature = member.slice(0, equals).trim().toLowerCase();
        const raw = member.slice(equals + 1).trim();
        const close = raw.indexOf(')');
        const inner = close === -1 ? raw.slice(1) : raw.slice(1, close);
        const allowlist = raw.startsWith('(')
          ? `(${inner.trim().split(WHITESPACE_RUN).filter(Boolean).join(' ')})`
          : raw;
        return [[feature, allowlist]];
      })
      // The first occurrence of a feature wins.
      .filter(
        ([feature], index, entries) =>
          entries.findIndex(([first]) => first === feature) === index,
      ),
  );
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
  const failing: string[] = [
    ...DISABLED_FEATURES.filter((feature) => !isClosed(policy.get(feature))),
    ...(isClosed(policy.get('sync-xhr')) ? [] : ['sync-xhr']),
  ];
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
