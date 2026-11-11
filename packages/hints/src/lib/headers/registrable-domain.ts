/**
 * An approximation of "registrable domain" (public suffix plus one label),
 * used to tell first-party hosts from third-party ones the way Webbkoll
 * does with the public suffix list.
 *
 * The package carries no public suffix list, so this uses the rule that
 * covers the common cases: the last two labels, or the last three when the
 * top-level domain is a two letter country code and the label before it is
 * a generic second level such as `co`, `com` or `gov`. IP addresses and
 * single label hosts are returned unchanged.
 */

const SECOND_LEVEL = new Set([
  'ac',
  'co',
  'com',
  'edu',
  'gov',
  'ne',
  'net',
  'or',
  'org',
]);

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** Returns the registrable domain of a host name, lower-cased. */
export function registrableDomain(host: string): string {
  const name = host.trim().toLowerCase().replace(/\.$/, '');
  if (IPV4.test(name) || name.includes(':') || !name.includes('.')) {
    return name;
  }
  const labels = name.split('.');
  const tld = labels.at(-1) ?? '';
  const second = labels.at(-2) ?? '';
  const keep = tld.length === 2 && SECOND_LEVEL.has(second) ? 3 : 2;
  return labels.slice(-keep).join('.');
}

/** True when the host is an IP address or a name without a dot. */
export function isBareHost(host: string): boolean {
  const name = host.trim().toLowerCase();
  return IPV4.test(name) || name.includes(':') || !name.includes('.');
}

/**
 * True when `url` points at a host outside `registrable`. Relative or
 * unparsable URLs have no host and are never third-party, as in Webbkoll.
 */
export function isThirdParty(url: string, registrable: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return host !== '' && registrableDomain(host) !== registrable;
}
