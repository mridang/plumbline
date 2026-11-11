/**
 * Referrer-Policy analysis.
 *
 * Which declaration is in effect follows Webbkoll (`worker.ex`, based on
 * Firefox 63): `<meta name="referrer">` wins over
 * `<meta http-equiv="Referrer-Policy">`, which wins over the response
 * header. When several policies are listed the last one the browser knows is
 * used. The levels are Mozilla Observatory's (`tests/referrer-policy.js`);
 * the OWASP profile requires exactly `no-referrer`.
 */
import { finding, type Finding, type Profile } from './finding.js';

const PRIVATE = new Set([
  'no-referrer',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
]);
const UNSAFE = new Set([
  'origin',
  'origin-when-cross-origin',
  'unsafe-url',
  'no-referrer-when-downgrade',
]);

export interface ReferrerSources {
  /** Contents of `<meta name="referrer">`. */
  metaName: string[];
  /** Contents of `<meta http-equiv="Referrer-Policy">`. */
  metaHttpEquiv: string[];
  /** Values of the `Referrer-Policy` response header. */
  header: string[];
}

/**
 * Picks the declaration in effect: meta name, then http-equiv, then header.
 * Returns null when none is declared.
 */
export function effectiveReferrerPolicy(
  sources: ReferrerSources,
): string | null {
  const chosen =
    sources.metaName.at(-1) ??
    sources.metaHttpEquiv.at(-1) ??
    (sources.header.length > 0 ? sources.header.join(', ') : undefined);
  return chosen === undefined ? null : chosen;
}

/** The last token the browser would recognise, or null if there is none. */
export function lastKnownPolicy(declared: string): string | null {
  const tokens = declared
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter((token) => PRIVATE.has(token) || UNSAFE.has(token));
  return tokens.at(-1) ?? null;
}

/** Findings for the declaration in effect (null when there is none). */
export function referrerPolicyFindings(
  declared: string | null,
  profile: Profile,
): Finding[] {
  if (profile === 'owasp') {
    if (declared === null) {
      return [
        finding('error', "The 'Referrer-Policy' header was not specified."),
      ];
    }
    // The last valid value is the one in force.
    const policy = declared.split(',').at(-1)?.trim().toLowerCase();
    return policy === 'no-referrer'
      ? []
      : [
          finding(
            'error',
            "The 'Referrer-Policy' header should be 'no-referrer'.",
          ),
        ];
  }

  if (declared === null) {
    return [
      finding(
        'warning',
        "Referrer-Policy header not implemented. Set to 'strict-origin-when-cross-origin' at a minimum.",
      ),
    ];
  }
  const policy = lastKnownPolicy(declared);
  if (policy === null) {
    return [
      finding(
        'error',
        "Referrer-Policy header cannot be recognized. Set to 'strict-origin-when-cross-origin' at a minimum.",
      ),
    ];
  }
  if (UNSAFE.has(policy)) {
    return [
      finding(
        'error',
        "Referrer-Policy header set unsafely to 'origin', 'origin-when-cross-origin', 'unsafe-url' or 'no-referrer-when-downgrade'. Set to 'strict-origin-when-cross-origin' at a minimum.",
      ),
    ];
  }
  return [];
}
