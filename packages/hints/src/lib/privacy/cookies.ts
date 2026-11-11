import { truncate } from './local-storage.js';
import { isSameParty, normalizeHost } from './registrable-domain.js';

/** Webbkoll cuts cookie names to this many characters when listing them. */
const COOKIE_NAME_LENGTH = 20;

/** A cookie seen on a response or in `document.cookie`. */
export interface CookieRecord {
  name: string;
  /** Domain the cookie belongs to: the Domain attribute or the setting host. */
  domain: string;
  /** The Path attribute, `/` when absent (unknown for script cookies). */
  path: string;

  /**
   * `session` when the cookie has no expiry, `persistent` when it has one and
   * `unknown` for cookies read from `document.cookie`, which hides expiry.
   */
  lifetime: 'session' | 'persistent' | 'unknown';
  /** ISO 8601 expiry of a persistent cookie, otherwise null. */
  expires: string | null;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string | null;
  /** True when it was read from `document.cookie` rather than a header. */
  fromScript: boolean;
}

/**
 * Splits a combined `Set-Cookie` header value into single cookies. Several
 * cookies may be folded into one string with commas; a comma only starts a
 * new cookie when what follows looks like `name=`, so the comma inside an
 * `Expires=Wed, 21 Oct ...` date is left alone.
 */
export function splitSetCookie(value: string): string[] {
  return value
    .split(/,(?=\s*[^;,=\s]+=)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** True when `host` is `domain` or one of its subdomains. */
function domainMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Parses one `Set-Cookie` value, set by `host` when it has no Domain. Returns
 * null for what a browser would not keep, so that it is not counted: a value
 * that is not `name=value`, a `Domain` that does not cover the setting host,
 * and a cookie that is already expired (`Max-Age` of 0 or less, or a past
 * `Expires`), which is how a server deletes a cookie. `Max-Age` wins over
 * `Expires`, as in RFC 6265.
 */
export function parseSetCookie(
  header: string,
  host: string,
  now: number = Date.now(),
): CookieRecord | null {
  const [pair, ...attributes] = header.split(';').map((part) => part.trim());
  const name = pair.split('=', 1)[0]?.trim();
  if (!name || !pair.includes('=')) {
    return null;
  }
  const origin = normalizeHost(host);
  let domain = origin;
  let path = '/';
  let expiresAt: number | null = null;
  let maxAge: number | null = null;
  let secure = false;
  let httpOnly = false;
  let sameSite: string | null = null;
  for (const attribute of attributes) {
    const [key, ...rest] = attribute.split('=');
    const value = rest.join('=').trim();
    switch (key.trim().toLowerCase()) {
      case 'domain': {
        if (value) {
          domain = normalizeHost(value);
        }
        break;
      }
      case 'path': {
        if (value.startsWith('/')) {
          path = value;
        }
        break;
      }
      case 'expires': {
        const time = Date.parse(value);
        if (!Number.isNaN(time)) {
          expiresAt = time;
        }
        break;
      }
      case 'max-age': {
        if (/^-?\d+$/.test(value)) {
          maxAge = Number(value);
        }
        break;
      }
      case 'secure': {
        secure = true;
        break;
      }
      case 'httponly': {
        httpOnly = true;
        break;
      }
      case 'samesite': {
        sameSite = value || null;
        break;
      }
    }
  }
  if (!domainMatches(origin, domain)) {
    return null; // The browser rejects a Domain that does not cover the host.
  }
  if (maxAge !== null) {
    expiresAt = now + maxAge * 1000;
  }
  if (expiresAt !== null && expiresAt <= now) {
    return null;
  }
  return {
    name,
    domain,
    path,
    lifetime: expiresAt === null ? 'session' : 'persistent',
    expires: expiresAt === null ? null : new Date(expiresAt).toISOString(),
    secure,
    httpOnly,
    sameSite,
    fromScript: false,
  };
}

/** Reads every cookie from the `Set-Cookie` header(s) of one response. */
export function cookiesFromHeaders(
  setCookie: string | string[] | undefined,
  host: string,
): CookieRecord[] {
  if (setCookie === undefined) {
    return [];
  }
  const values = Array.isArray(setCookie) ? setCookie : [setCookie];
  return values
    .flatMap(splitSetCookie)
    .map((value) => parseSetCookie(value, host))
    .filter((cookie): cookie is CookieRecord => cookie !== null);
}

/** Reads the cookies visible to script from a `document.cookie` string. */
export function cookiesFromDocument(
  cookie: string,
  pageHost: string,
): CookieRecord[] {
  return cookie
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.includes('='))
    .map((part) => ({
      name: part.split('=', 1)[0].trim(),
      domain: normalizeHost(pageHost),
      path: '/',
      lifetime: 'unknown' as const,
      expires: null,
      secure: false,
      httpOnly: false,
      sameSite: null,
      fromScript: true,
    }));
}

/** Cookies grouped by whether they belong to the page's registrable domain. */
export interface CookieSummary {
  firstParty: CookieRecord[];
  thirdParty: CookieRecord[];
  /** Unique third-party cookie domains. */
  thirdPartyDomains: string[];
}

/**
 * Splits cookies into first and third party like Webbkoll: a cookie is first
 * party when the registrable domain of its domain equals the page's. A cookie
 * is counted once: the same domain, path and name seen again is dropped, and
 * so is a `document.cookie` entry that a header already set under a domain
 * covering the page, as the browser holds one cookie for both.
 */
export function summarizeCookies(
  cookies: readonly CookieRecord[],
  pageHost: string,
): CookieSummary {
  const firstParty: CookieRecord[] = [];
  const thirdParty: CookieRecord[] = [];
  const seen = new Set<string>();
  const keep = new Set<string>();
  const page = normalizeHost(pageHost);
  // Header cookies first, so script cookies can be matched against them.
  const ordered = [
    ...cookies.filter((cookie) => !cookie.fromScript),
    ...cookies.filter((cookie) => cookie.fromScript),
  ];
  for (const cookie of ordered) {
    const key = `${cookie.domain}|${cookie.path}|${cookie.name}`;
    if (seen.has(key)) {
      continue;
    }
    if (
      cookie.fromScript &&
      [...seen].some((other) => {
        const [domain, , name] = other.split('|');
        return name === cookie.name && domainMatches(page, domain);
      })
    ) {
      continue;
    }
    seen.add(key);
    if (isSameParty(cookie.domain, pageHost)) {
      firstParty.push(cookie);
    } else {
      thirdParty.push(cookie);
      keep.add(cookie.domain);
    }
  }
  return { firstParty, thirdParty, thirdPartyDomains: [...keep] };
}

/**
 * Describes one cookie with the fields Webbkoll tabulates: domain, name (cut
 * to 20 characters), expiry or session, Secure, HttpOnly and SameSite. The
 * value is left out on purpose, as it can be an identifier.
 */
export function describeCookie(cookie: CookieRecord): string {
  const lifetime =
    cookie.lifetime === 'persistent'
      ? `expires ${cookie.expires}`
      : cookie.lifetime;
  return (
    `${cookie.domain} ${truncate(cookie.name, COOKIE_NAME_LENGTH)} (${lifetime}, ` +
    `${cookie.secure ? 'Secure' : 'not Secure'}, ` +
    `${cookie.httpOnly ? 'HttpOnly' : 'not HttpOnly'}, ` +
    `${cookie.sameSite ? `SameSite=${cookie.sameSite}` : 'no SameSite'})`
  );
}

/**
 * Writes one cookie as the header line that set it, with the attributes that
 * were seen and no value. A cookie read from `document.cookie` has no header,
 * so it is written as `Cookie` with only its name.
 */
export function cookieLine(cookie: CookieRecord): string {
  if (cookie.fromScript) {
    return `Cookie: ${cookie.name}`;
  }
  return [
    `Set-Cookie: ${cookie.name}`,
    `Domain=${cookie.domain}`,
    `Path=${cookie.path}`,
    ...(cookie.expires ? [`Expires=${cookie.expires}`] : []),
    ...(cookie.secure ? ['Secure'] : []),
    ...(cookie.httpOnly ? ['HttpOnly'] : []),
    ...(cookie.sameSite ? [`SameSite=${cookie.sameSite}`] : []),
  ].join('; ');
}
