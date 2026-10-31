/**
 * @packageDocumentation
 *
 * Turning what someone typed into the box into the address to scan. People
 * type a bare domain (`example.com`), a domain with a path, or a full URL; all
 * of them become an absolute `https:` (or explicit `http:`) URL. Anything that
 * is not a public web address is refused before a single request is made: the
 * Worker also only fetches public addresses (`global_fetch_strictly_public`),
 * but a clear sentence beats a failed scan.
 */

/** What reading the input came to: the URL to scan, or why it cannot be. */
export type Target =
  | { readonly ok: true; readonly url: URL }
  | { readonly ok: false; readonly reason: string };

/** The longest input accepted; no real address is anywhere near it. */
const MAX_LENGTH = 2048;

/** Hostnames that only mean something on the machine or network asking. */
const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];

/** Whether a hostname is an IPv4 or IPv6 literal. */
function isIpLiteral(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith('[');
}

/**
 * The URL to scan for an input, or the reason it is refused. A missing scheme
 * means `https:`. Only `http:` and `https:` are scanned, the host must be a
 * dotted public name (no IP literals, no `localhost`, no single-label intranet
 * names), and credentials in the URL are refused rather than sent on.
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
  const hostname = url.hostname.toLowerCase();
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
  url.hash = '';
  return { ok: true, url };
}
