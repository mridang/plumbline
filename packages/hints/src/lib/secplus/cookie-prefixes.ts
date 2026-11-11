/**
 * Cookie name-prefix correctness, per the cookie-prefixes rules in RFC 6265bis
 * (https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis) and
 * MDN (https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Set-Cookie#cookie_prefixes).
 *
 * The prefixes are a promise the browser enforces:
 *
 *   - `__Host-` cookies must be `Secure`, must have `Path=/`, and must **not**
 *     set a `Domain` attribute — so the cookie is locked to the exact origin
 *     that set it and cannot be overwritten by a subdomain.
 *   - `__Secure-` cookies must be `Secure`.
 *
 * A browser silently rejects a cookie whose attributes do not match its
 * prefix, so a mismatch is a bug that drops the cookie entirely. The prefix is
 * matched case-insensitively, as browsers match it.
 *
 * This is deliberately narrow: it checks only the prefix contract, not the
 * general `Secure`/`HttpOnly`/`SameSite` hygiene the `cookies` hint covers.
 */
import { finding, type Finding } from '../headers/finding.js';

/** The parts of a `Set-Cookie` the prefix rules depend on. */
export interface PrefixCookie {
  /** The cookie name, as written (prefix comparison is case-insensitive). */
  name: string;
  /** Whether the `Secure` attribute is present. */
  secure: boolean;
  /** The `Path` attribute value, or null when absent. */
  path: string | null;
  /** The `Domain` attribute value, or null when absent. */
  domain: string | null;
}

/**
 * Parses the parts of one `Set-Cookie` value this check needs. Returns null
 * for a header with no cookie name. Only the attributes relevant to the prefix
 * rules are read; everything else is ignored.
 */
export function parsePrefixCookie(raw: string): PrefixCookie | null {
  const [pair = '', ...attributes] = raw.trim().split(';');
  const equals = pair.indexOf('=');
  const name = (equals === -1 ? '' : pair.slice(0, equals)).trim();
  if (name === '') {
    return null;
  }
  const cookie: PrefixCookie = {
    name,
    secure: false,
    path: null,
    domain: null,
  };
  for (const attribute of attributes) {
    const at = attribute.indexOf('=');
    const key = (at === -1 ? attribute : attribute.slice(0, at))
      .trim()
      .toLowerCase();
    const value = at === -1 ? '' : attribute.slice(at + 1).trim();
    switch (key) {
      case 'secure': {
        cookie.secure = true;

        break;
      }
      case 'path': {
        cookie.path = value;

        break;
      }
      case 'domain': {
        cookie.domain = value;

        break;
      }
      // No default
    }
  }
  return cookie;
}

/** Findings for one parsed cookie, checking only its prefix contract. */
function cookiePrefixFinding(cookie: PrefixCookie): Finding[] {
  const lower = cookie.name.toLowerCase();
  const findings: Finding[] = [];

  if (lower.startsWith('__host-')) {
    const problems: string[] = [];
    if (!cookie.secure) {
      problems.push('it is not Secure');
    }
    if (cookie.path !== '/') {
      problems.push("its Path is not '/'");
    }
    if (cookie.domain !== null) {
      problems.push('it sets a Domain attribute');
    }
    if (problems.length > 0) {
      findings.push(
        finding(
          'error',
          `Cookie '${cookie.name}' uses the __Host- prefix but ${problems.join(', ')}; the browser will reject it. A __Host- cookie must be Secure, have Path=/ and set no Domain.`,
        ),
      );
    }
    return findings;
  }

  if (lower.startsWith('__secure-') && !cookie.secure) {
    findings.push(
      finding(
        'error',
        `Cookie '${cookie.name}' uses the __Secure- prefix but is not Secure; the browser will reject it. Add the Secure attribute.`,
      ),
    );
  }

  return findings;
}

/** Findings for every `Set-Cookie` value of a response. */
export function cookiePrefixFindings(
  setCookieValues: readonly string[],
): Finding[] {
  return setCookieValues
    .map((value) => parsePrefixCookie(value))
    .filter((cookie): cookie is PrefixCookie => cookie !== null)
    .flatMap((cookie) => cookiePrefixFinding(cookie));
}
