import { UsageError } from './args.js';

/**
 * Turns what was typed after `scan` into the absolute URL webhint scans. A
 * bare domain (`example.com`, `example.com/blog`) is taken to mean its HTTPS
 * site, since that is what a visitor gets; an explicit `http://` is kept so a
 * local or plain-HTTP site can still be scanned.
 *
 * @param input The URL or domain as typed.
 * @returns The absolute http(s) URL.
 * @throws UsageError when the input is not a usable http(s) URL or host.
 */
export function normalizeTarget(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new UsageError('scan needs a URL or a domain to scan');
  }
  // Anything with a scheme is taken as written; everything else is a host.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new UsageError(`"${input}" is not a URL or a domain`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UsageError(`only http and https URLs can be scanned`);
  }
  if (url.hostname.length === 0) {
    throw new UsageError(`"${input}" has no host`);
  }
  return url.href;
}
