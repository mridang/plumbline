/**
 * Set-Cookie analysis, a port of Mozilla Observatory's `tests/cookies.js`.
 *
 * Every cookie is checked and the worst problem found decides the result,
 * exactly as Observatory orders them (least to most serious):
 *
 * - without Secure, but protected by HSTS
 * - without Secure
 * - session cookie without Secure, but protected by HSTS
 * - SameSite set to something invalid (or `None` without `Secure`)
 * - anti-CSRF cookie without SameSite
 * - session cookie without HttpOnly
 * - session cookie without Secure.
 *
 * A "session" cookie is one whose name contains `login` or `sess`; an
 * anti-CSRF cookie has `csrf` in its name.
 */
import { finding } from './finding.js';
import type { Finding } from './finding.js';

export interface Cookie {
  name: string;
  secure: boolean;
  httpOnly: boolean;
  /** Lower-cased SameSite value when it is lax, strict or none. */
  sameSite?: string;
  /** True when a SameSite attribute exists but its value is not valid. */
  sameSiteInvalid: boolean;
}

// See https://github.com/mozilla/http-observatory/issues/282
const IGNORED_COOKIES = new Set(['heroku-session-affinity']);

/** Parses one `Set-Cookie` header value. */
export function parseSetCookie(raw: string): Cookie | null {
  const [pair = '', ...attributes] = raw.trim().split(';');
  const equals = pair.indexOf('=');
  const name = (equals === -1 ? '' : pair.slice(0, equals)).trim();
  if (name === '') {
    return null;
  }
  const parsed = attributes.map((attribute) => {
    const at = attribute.indexOf('=');
    return {
      key: (at === -1 ? attribute : attribute.slice(0, at))
        .trim()
        .toLowerCase(),
      value:
        at === -1
          ? ''
          : attribute
              .slice(at + 1)
              .trim()
              .toLowerCase(),
    };
  });
  const sameSites = parsed
    .filter(({ key }) => key === 'samesite')
    .map(({ value }) => value);
  const valid = (value: string): boolean =>
    ['lax', 'strict', 'none'].includes(value);
  // The last valid SameSite value wins; any invalid one is remembered.
  const sameSite = sameSites.findLast((value) => valid(value));
  return {
    name,
    secure: parsed.some(({ key }) => key === 'secure'),
    httpOnly: parsed.some(({ key }) => key === 'httponly'),
    ...(sameSite === undefined ? {} : { sameSite }),
    sameSiteInvalid: sameSites.some((value) => !valid(value)),
  };
}

export type CookiesResult =
  | 'cookies-secure-with-httponly-sessions-and-samesite'
  | 'cookies-secure-with-httponly-sessions'
  | 'cookies-not-found'
  | 'cookies-without-secure-flag-but-protected-by-hsts'
  | 'cookies-session-without-secure-flag-but-protected-by-hsts'
  | 'cookies-without-secure-flag'
  | 'cookies-samesite-flag-invalid'
  | 'cookies-anticsrf-without-samesite-flag'
  | 'cookies-session-without-httponly-flag'
  | 'cookies-session-without-secure-flag';

/** Failing results from least to most serious. */
const BADNESS: readonly CookiesResult[] = [
  'cookies-without-secure-flag-but-protected-by-hsts',
  'cookies-without-secure-flag',
  'cookies-session-without-secure-flag-but-protected-by-hsts',
  'cookies-samesite-flag-invalid',
  'cookies-anticsrf-without-samesite-flag',
  'cookies-session-without-httponly-flag',
  'cookies-session-without-secure-flag',
];

/** Analyses the cookies of a response; returns the worst result. */
export function analyzeCookies(
  setCookieValues: string[],
  hstsProtected: boolean,
): CookiesResult {
  const cookies = setCookieValues.flatMap((raw) => {
    const cookie = parseSetCookie(raw);
    return cookie !== null && !IGNORED_COOKIES.has(cookie.name) ? [cookie] : [];
  });
  if (cookies.length === 0) {
    return 'cookies-not-found';
  }

  const notes = cookies.flatMap((cookie) => {
    const lowered = cookie.name.toLowerCase();
    const session = ['login', 'sess'].some((part) => lowered.includes(part));
    const antiCsrf = lowered.includes('csrf');
    const found: (CookiesResult | false)[] = [
      cookie.sameSiteInvalid && 'cookies-samesite-flag-invalid',
      // Browsers reject SameSite=None cookies that are not Secure.
      !cookie.secure &&
        cookie.sameSite === 'none' &&
        'cookies-samesite-flag-invalid',
      !cookie.secure &&
        (hstsProtected
          ? 'cookies-without-secure-flag-but-protected-by-hsts'
          : 'cookies-without-secure-flag'),
      antiCsrf && !cookie.sameSite && 'cookies-anticsrf-without-samesite-flag',
      session &&
        !cookie.secure &&
        (hstsProtected
          ? 'cookies-session-without-secure-flag-but-protected-by-hsts'
          : 'cookies-session-without-secure-flag'),
      session && !cookie.httpOnly && 'cookies-session-without-httponly-flag',
    ];
    return found.filter((result) => result !== false);
  });
  const worst = notes.reduce<CookiesResult | null>(
    (current, result) =>
      current === null || BADNESS.indexOf(result) > BADNESS.indexOf(current)
        ? result
        : current,
    null,
  );
  if (worst !== null) {
    return worst;
  }
  return cookies.some((cookie) => !cookie.sameSite)
    ? 'cookies-secure-with-httponly-sessions'
    : 'cookies-secure-with-httponly-sessions-and-samesite';
}

const MESSAGES: Partial<Record<CookiesResult, Finding>> = {
  'cookies-secure-with-httponly-sessions': finding(
    'hint',
    'All cookies use the Secure flag and all session cookies use the HttpOnly flag. Use SameSite.',
  ),
  'cookies-without-secure-flag-but-protected-by-hsts': finding(
    'warning',
    'Cookies set without using the Secure flag, but transmission over HTTP prevented by HSTS. Use the Secure flag.',
  ),
  'cookies-session-without-secure-flag-but-protected-by-hsts': finding(
    'warning',
    'Session cookie set without the Secure flag, but transmission over HTTP prevented by HSTS. Use the Secure flag.',
  ),
  'cookies-without-secure-flag': finding(
    'error',
    'Cookies set without using the Secure flag or set over HTTP. Use the Secure flag and set up HSTS.',
  ),
  'cookies-samesite-flag-invalid': finding(
    'error',
    'Cookies use SameSite flag, but set to something other than Strict or Lax (or SameSite=None without Secure). Use SameSite Strict or Lax.',
  ),
  'cookies-anticsrf-without-samesite-flag': finding(
    'error',
    'Anti-CSRF tokens set without using the SameSite flag. Use SameSite Strict or Lax.',
  ),
  'cookies-session-without-httponly-flag': finding(
    'error',
    'Session cookie set without using the HttpOnly flag. Use HttpOnly.',
  ),
  'cookies-session-without-secure-flag': finding(
    'error',
    'Session cookie set without using the Secure flag or set over HTTP. Use the Secure flag and set up HSTS.',
  ),
};

/** Findings for the cookies of a response. */
export function cookieFindings(
  setCookieValues: string[],
  hstsProtected: boolean,
): Finding[] {
  const message = MESSAGES[analyzeCookies(setCookieValues, hstsProtected)];
  return message ? [message] : [];
}
