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
 * - session cookie without Secure
 *
 * A "session" cookie is one whose name contains `login` or `sess`; an
 * anti-CSRF cookie has `csrf` in its name.
 */
import { finding, type Finding } from './finding.js';

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
  const name = (equals < 0 ? '' : pair.slice(0, equals)).trim();
  if (name === '') {
    return null;
  }
  const cookie: Cookie = {
    name,
    secure: false,
    httpOnly: false,
    sameSiteInvalid: false,
  };
  for (const attribute of attributes) {
    const at = attribute.indexOf('=');
    const key = (at < 0 ? attribute : attribute.slice(0, at))
      .trim()
      .toLowerCase();
    const value =
      at < 0
        ? ''
        : attribute
            .slice(at + 1)
            .trim()
            .toLowerCase();
    if (key === 'secure') {
      cookie.secure = true;
    } else if (key === 'httponly') {
      cookie.httpOnly = true;
    } else if (key === 'samesite') {
      if (['lax', 'strict', 'none'].includes(value)) {
        cookie.sameSite = value;
      } else {
        cookie.sameSiteInvalid = true;
      }
    }
  }
  return cookie;
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
  const cookies = setCookieValues
    .map(parseSetCookie)
    .filter((c): c is Cookie => c !== null && !IGNORED_COOKIES.has(c.name));
  if (cookies.length === 0) {
    return 'cookies-not-found';
  }

  let worst: CookiesResult | null = null;
  const note = (result: CookiesResult): void => {
    if (worst === null || BADNESS.indexOf(result) > BADNESS.indexOf(worst)) {
      worst = result;
    }
  };

  let missingSameSite = false;
  for (const cookie of cookies) {
    const lowered = cookie.name.toLowerCase();
    const session = ['login', 'sess'].some((part) => lowered.includes(part));
    const antiCsrf = lowered.includes('csrf');

    if (cookie.sameSiteInvalid) {
      note('cookies-samesite-flag-invalid');
    }
    // Browsers reject SameSite=None cookies that are not Secure.
    if (!cookie.secure && cookie.sameSite === 'none') {
      note('cookies-samesite-flag-invalid');
    }
    if (!cookie.secure) {
      note(
        hstsProtected
          ? 'cookies-without-secure-flag-but-protected-by-hsts'
          : 'cookies-without-secure-flag',
      );
    }
    if (antiCsrf && !cookie.sameSite) {
      note('cookies-anticsrf-without-samesite-flag');
    }
    if (session && !cookie.secure) {
      note(
        hstsProtected
          ? 'cookies-session-without-secure-flag-but-protected-by-hsts'
          : 'cookies-session-without-secure-flag',
      );
    }
    if (session && !cookie.httpOnly) {
      note('cookies-session-without-httponly-flag');
    }
    if (!cookie.sameSite) {
      missingSameSite = true;
    }
  }
  if (worst !== null) {
    return worst;
  }
  return missingSameSite
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
