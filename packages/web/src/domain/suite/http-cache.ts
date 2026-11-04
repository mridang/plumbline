/**
 * @packageDocumentation
 *
 * What a site says about how long its page may be reused, read from the
 * response headers the way a cache reads them: `Cache-Control` (`no-store`,
 * `no-cache`, `max-age`, `s-maxage`), `Age` and `Expires`, plus the validators
 * (`ETag`, `Last-Modified`) a later request sends back to ask whether the page
 * changed. The checks use this to avoid fetching a page the site has said is
 * still fresh, and to ask a conditional question when it is not, so a site is
 * never read more than it has to be.
 */

/** The longest a page is taken to be fresh, in seconds, whatever the site says. */
export const MAX_FRESH_SECONDS = 60 * 60;

/** What identifies a version of a page. */
export interface Validators {
  readonly etag: string | null;
  readonly lastModified: string | null;
}

/** The directives of a `Cache-Control` value that matter here. */
export interface Directives {
  readonly noStore: boolean;
  readonly noCache: boolean;
  readonly maxAge: number | null;
}

/** The `Cache-Control` directives in `value`; `s-maxage` wins over `max-age`, as for a shared cache. */
export function directivesOf(value: string | null): Directives {
  let noStore = false;
  let noCache = false;
  let maxAge: number | null = null;
  let shared: number | null = null;
  for (const part of (value ?? '').split(',')) {
    const [name = '', argument] = part.trim().toLowerCase().split('=');
    const seconds = Number(argument?.replace(/"/g, ''));
    if (name === 'no-store' || name === 'private') {
      noStore = true;
    } else if (name === 'no-cache') {
      noCache = true;
    } else if (
      name === 's-maxage' &&
      Number.isFinite(seconds) &&
      seconds >= 0
    ) {
      shared = seconds;
    } else if (name === 'max-age' && Number.isFinite(seconds) && seconds >= 0) {
      maxAge = seconds;
    }
  }
  return { noStore, noCache, maxAge: shared ?? maxAge };
}

/** The validators of a response, or null when it has none. */
export function validatorsOf(headers: Headers): Validators | null {
  const etag = headers.get('etag');
  const lastModified = headers.get('last-modified');
  return etag || lastModified ? { etag, lastModified } : null;
}

/**
 * When the page stops being fresh, as an ISO time, or null when the site gives
 * no time or says it must be checked every time (`no-cache`, `no-store`,
 * `private`, `max-age=0`). Never more than {@link MAX_FRESH_SECONDS} ahead.
 */
export function freshUntil(headers: Headers, now: number): string | null {
  const { noStore, noCache, maxAge } = directivesOf(
    headers.get('cache-control'),
  );
  if (noStore || noCache) {
    return null;
  }
  let seconds: number | null = maxAge;
  if (seconds === null) {
    const expires = Date.parse(headers.get('expires') ?? '');
    seconds = Number.isNaN(expires) ? null : (expires - now) / 1000;
  }
  if (seconds === null) {
    return null;
  }
  const age = Number(headers.get('age'));
  const left = Math.min(
    seconds - (Number.isFinite(age) && age > 0 ? age : 0),
    MAX_FRESH_SECONDS,
  );
  return left > 0 ? new Date(now + left * 1000).toISOString() : null;
}

/** The request headers that ask whether a page changed since the validators were given. */
export function conditionalHeaders(
  validators: Validators | null,
): Record<string, string> {
  return {
    ...(validators?.etag ? { 'if-none-match': validators.etag } : {}),
    ...(validators?.lastModified
      ? { 'if-modified-since': validators.lastModified }
      : {}),
  };
}
