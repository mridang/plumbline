/**
 * Content Security Policy depth evaluation, in the style of Google's CSP
 * Evaluator (https://csp-evaluator.withgoogle.com) and the web.dev strict-CSP
 * guidance (https://web.dev/articles/strict-csp).
 *
 * This is deliberately distinct from the `csp` hint, which reproduces Mozilla
 * Observatory's pass/fail scoring. Here the policy is dissected the way the CSP
 * Evaluator dissects it — the questions an XSS reviewer asks:
 *
 *   - Does `script-src` allow `'unsafe-inline'` with no nonce or hash to
 *     neutralise it? (The single most common CSP bypass.)
 *   - Does any directive allow `'unsafe-eval'`?
 *   - Is script execution restricted at all (is there a `script-src` or a
 *     `default-src` to fall back to)?
 *   - Is `object-src` locked to `'none'` (plugins are a classic bypass)?
 *   - Is `base-uri` set (an injected `<base>` tag can rewrite relative script
 *     URLs)?
 *   - Does `script-src` lean on a host/scheme allowlist (`*`, `https:`, a CDN)
 *     rather than `'strict-dynamic'` with nonces, which the CSP Evaluator and
 *     web.dev both flag as fragile?
 *
 * The policy is parsed **once** with the shared Observatory CSP parser
 * (`src/lib/headers/csp.ts`'s `parseCsp`); this module never re-parses a CSP
 * string. It only inspects the resulting {@link CspMap}. An absent or
 * unparsable policy yields no findings here — presence and syntax are the
 * `csp` hint's job, not this deeper evaluation's.
 */
import { finding, type Finding } from '../headers/finding.js';
import { CspParseError, parseCsp, type CspMap } from '../headers/csp.js';

/**
 * Sources broad enough to let an attacker host script anywhere. These are the
 * scheme/wildcard sources the CSP Evaluator marks as allowing arbitrary code.
 */
const BROAD_SOURCES = new Set([
  '*',
  'http:',
  'https:',
  'ftp:',
  'http://*',
  'https://*',
  'http://*.*',
  'https://*.*',
  'data:',
]);

/** Prefixes of a nonce or hash source, which neutralise `'unsafe-inline'`. */
const NONCE_HASH_PREFIXES = ["'nonce-", "'sha256-", "'sha384-", "'sha512-"];

/** True when any source is a nonce or a hash. */
function hasNonceOrHash(sources: Iterable<string>): boolean {
  for (const source of sources) {
    if (NONCE_HASH_PREFIXES.some((prefix) => source.startsWith(prefix))) {
      return true;
    }
  }
  return false;
}

/**
 * The sources that apply to `directive`, falling back to `default-src` as a
 * browser does for the fetch directives. Returns null when neither the
 * directive nor `default-src` is present (nothing restricts it).
 */
function effective(csp: CspMap, directive: string): Set<string> | null {
  return csp.get(directive) ?? csp.get('default-src') ?? null;
}

/** True when a source set leans on a host or scheme allowlist (not keywords). */
function hasHostOrSchemeAllowlist(sources: Iterable<string>): boolean {
  for (const source of sources) {
    // Keyword sources are wrapped in quotes; a bare token is a host or scheme.
    if (!source.startsWith("'")) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluates the depth of a Content Security Policy. `cspList` is the raw value
 * of every `Content-Security-Policy` header (and may include `<meta>` policy
 * contents). Returns the findings, worst first is not guaranteed — the caller
 * surfaces them all.
 */
export function evaluateCspStrength(cspList: readonly string[]): Finding[] {
  const policies = cspList
    .flatMap((value) => value.split(','))
    .map((policy) => policy.trim())
    .filter((policy) => policy !== '');
  if (policies.length === 0) {
    // No policy to evaluate; the `csp` hint reports a missing CSP.
    return [];
  }

  let csp: CspMap;
  try {
    csp = parseCsp(policies);
  } catch (error) {
    if (error instanceof CspParseError) {
      // An unparsable policy is the `csp` hint's finding, not this one's.
      return [];
    }
    throw error;
  }

  const findings: Finding[] = [];

  const scriptSrc = effective(csp, 'script-src');
  if (scriptSrc === null) {
    findings.push(
      finding(
        'error',
        "No 'script-src' or 'default-src' directive; scripts may be loaded from any origin. Add script-src 'self' (with nonces or hashes).",
      ),
    );
  } else {
    // 'unsafe-inline' is ignored by the browser when a nonce or hash is also
    // present, so it is only a problem on its own.
    if (scriptSrc.has("'unsafe-inline'") && !hasNonceOrHash(scriptSrc)) {
      findings.push(
        finding(
          'error',
          "'script-src' allows 'unsafe-inline' with no nonce or hash to disable it; this defeats CSP's XSS protection. Use nonces or hashes with 'strict-dynamic'.",
        ),
      );
    }
    const broad = [...scriptSrc].filter((source) => BROAD_SOURCES.has(source));
    if (broad.length > 0) {
      findings.push(
        finding(
          'error',
          `'script-src' allows a broad source (${broad.join(', ')}); an attacker can host script there. Restrict script-src to 'self', nonces or hashes.`,
        ),
      );
    }
    // A host/scheme allowlist without 'strict-dynamic' is the fragile pattern
    // web.dev and the CSP Evaluator steer policies away from.
    if (
      !scriptSrc.has("'strict-dynamic'") &&
      hasHostOrSchemeAllowlist(scriptSrc)
    ) {
      findings.push(
        finding(
          'hint',
          "'script-src' relies on a host or scheme allowlist without 'strict-dynamic'; allowlists are easy to bypass. Prefer a nonce-based policy with 'strict-dynamic'.",
        ),
      );
    }
  }

  // 'unsafe-eval' in any of the script-bearing directives allows eval().
  const scriptLike = scriptSrc ?? new Set<string>();
  const styleSrc = effective(csp, 'style-src') ?? new Set<string>();
  if (scriptLike.has("'unsafe-eval'") || styleSrc.has("'unsafe-eval'")) {
    findings.push(
      finding(
        'error',
        "A directive allows 'unsafe-eval', which permits eval() and similar string-to-code APIs. Remove 'unsafe-eval'.",
      ),
    );
  }

  // object-src should be 'none': plugins (Flash, Java) are a classic bypass.
  const objectSrc = effective(csp, 'object-src');
  const objectLocked =
    objectSrc !== null && objectSrc.size === 1 && objectSrc.has("'none'");
  if (!objectLocked) {
    findings.push(
      finding(
        'warning',
        "'object-src' is not locked to 'none'; plugin content can be a CSP bypass. Add object-src 'none'.",
      ),
    );
  }

  // base-uri restricts <base>, which can otherwise rewrite relative script URLs.
  if (!csp.has('base-uri')) {
    findings.push(
      finding(
        'warning',
        "No 'base-uri' directive; an injected <base> tag can change where relative URLs (including scripts) resolve. Add base-uri 'none' or 'self'.",
      ),
    );
  }

  return findings;
}
