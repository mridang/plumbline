/**
 * @packageDocumentation
 *
 * Turning what someone typed into the box into the address to scan. People
 * type a bare domain (`example.com`), a domain with a path, or a full URL; all
 * of them become an absolute `https:` (or explicit `http:`) URL. Anything that
 * is not a public web address is refused before a single request is made: the
 * Worker also only fetches public addresses (`global_fetch_strictly_public`),
 * but a clear sentence beats a failed scan.
 *
 * The URL is also put in one canonical form ({@link canonicalUrl}), so the same
 * page typed two ways is one page: that is what is scanned, and what the
 * cooldown between scans of a page is keyed by (see `cooldown.ts`).
 */

/** What reading the input came to: the URL to scan, or why it cannot be. */
export type Target =
  | { readonly ok: true; readonly url: URL }
  | { readonly ok: false; readonly reason: string };

/** The longest input accepted; no real address is anywhere near it. */
const MAX_LENGTH = 2048;

/** Hostnames that only mean something on the machine or network asking. */
const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];

/**
 * Query parameters that only say where a visitor came from (campaign tags and
 * click ids). They never change what a page serves, so they are dropped.
 */
const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'yclid',
  'twclid',
  'li_fat_id',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  'igshid',
  'ref_src',
]);

/** The name of a raw `name=value` query pair, decoded. */
function nameOf(pair: string): string {
  const raw = pair.split('=', 1)[0] ?? '';
  try {
    return decodeURIComponent(raw.replaceAll('+', ' '));
  } catch {
    return raw;
  }
}

/** Whether a query parameter is a tracking one: a `utm_` tag or a known click id. */
function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith('utm_') || TRACKING_PARAMS.has(lower);
}

/**
 * The canonical form of a URL to scan. The URL parser already lowercases the
 * scheme and host, drops a default port and resolves `.` and `..` in the
 * path; on top of that the fragment goes (it never reaches the server), a
 * trailing dot on the host goes (`example.com.` is `example.com`), repeated
 * slashes in the path collapse to one, tracking parameters go, and the rest
 * of the query is sorted by name so its order does not matter.
 */
export function canonicalUrl(input: URL): URL {
  const url = new URL(input.href);
  url.hash = '';
  url.hostname = stripTrailingDots(url.hostname);
  url.pathname = url.pathname.replaceAll(/\/{2,}/g, '/');
  // The pairs are kept as they were written, not decoded and encoded again,
  // so a server that reads `+` and `%20` differently gets what was typed.
  const kept = url.search
    .slice(1)
    .split('&')
    .filter((pair) => pair !== '')
    .filter((pair) => !isTrackingParam(nameOf(pair)));
  kept.sort((a, b) => {
    const [x, y] = [nameOf(a), nameOf(b)];
    if (x < y) {
      return -1;
    }
    return x > y ? 1 : 0;
  });
  url.search = kept.join('&');
  return url;
}

/** The name without any dots at its end. */
function stripTrailingDots(name: string): string {
  let end = name.length;
  while (end > 0 && name[end - 1] === '.') {
    end -= 1;
  }
  return name.slice(0, end);
}

/** Whether a hostname is an IPv4 or IPv6 literal. */
function isIpLiteral(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith('[');
}

/**
 * The URL to scan for an input, or the reason it is refused. A missing scheme
 * means `https:`. Only `http:` and `https:` are scanned, the host must be a
 * dotted public name (no IP literals, no `localhost`, no single-label intranet
 * names), and credentials in the URL are refused rather than sent on. The
 * URL given back is the canonical one.
 */
export function readTarget(input: string): Target {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { ok: false, reason: 'Enter a domain or a URL to scan.' };
  }
  if (trimmed.length > MAX_LENGTH) {
    return { ok: false, reason: 'That address is too long.' };
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, reason: 'That is not a domain or a URL.' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return {
      ok: false,
      reason: 'Only http and https addresses can be scanned.',
    };
  }
  if (url.username !== '' || url.password !== '') {
    return { ok: false, reason: 'Leave the user name and password out.' };
  }
  const hostname = stripTrailingDots(url.hostname.toLowerCase());
  if (isIpLiteral(hostname)) {
    return { ok: false, reason: 'Enter a domain name, not an IP address.' };
  }
  if (
    !hostname.includes('.') ||
    hostname === 'localhost' ||
    LOCAL_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    return { ok: false, reason: 'Only public domains can be scanned.' };
  }
  return { ok: true, url: canonicalUrl(url) };
}
