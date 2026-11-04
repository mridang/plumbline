import { isIP } from '#net';

/**
 * Second level labels under which registrations happen one level deeper, for
 * example `co.uk`. This is a small built-in stand-in for the Public Suffix
 * List: the package has no dependency that ships the list, and the hints only
 * need the registrable domain of the scanned host. Hosts under a suffix that
 * is missing here resolve to the suffix itself plus one label, which at worst
 * makes a hint look at the wrong zone and report nothing.
 */
const MULTI_LABEL_SUFFIXES: ReadonlySet<string> = new Set([
  'co.uk',
  'org.uk',
  'me.uk',
  'ltd.uk',
  'plc.uk',
  'net.uk',
  'ac.uk',
  'gov.uk',
  'sch.uk',
  'com.au',
  'net.au',
  'org.au',
  'edu.au',
  'gov.au',
  'co.nz',
  'org.nz',
  'net.nz',
  'govt.nz',
  'ac.nz',
  'co.jp',
  'ne.jp',
  'or.jp',
  'ac.jp',
  'go.jp',
  'com.br',
  'net.br',
  'org.br',
  'gov.br',
  'com.cn',
  'net.cn',
  'org.cn',
  'gov.cn',
  'com.hk',
  'org.hk',
  'com.sg',
  'edu.sg',
  'com.tw',
  'org.tw',
  'co.in',
  'net.in',
  'org.in',
  'gov.in',
  'co.za',
  'org.za',
  'co.il',
  'org.il',
  'co.kr',
  'or.kr',
  'com.mx',
  'org.mx',
  'com.ar',
  'com.tr',
  'org.tr',
  'com.ua',
  'com.pl',
  'com.es',
  'com.pt',
  'com.my',
  'com.ph',
  'com.vn',
  'co.id',
  'co.th',
]);

/** Top level labels that never carry public mail. */
const NON_PUBLIC_TLDS: ReadonlySet<string> = new Set([
  'localhost',
  'local',
  'internal',
  'invalid',
  'test',
  'example',
]);

/**
 * Returns the registrable domain (organizational domain) of a host name, or
 * null when the host is an IP address, a single label or a non-public name.
 */
export function registrableDomain(hostname: string): string | null {
  const host = hostname.trim().toLowerCase().replace(/\.$/u, '');
  if (host === '' || isIP(host) !== 0 || host.startsWith('[')) {
    return null;
  }
  const labels = host.split('.');
  if (labels.length < 2 || labels.some((label) => label === '')) {
    return null;
  }
  if (NON_PUBLIC_TLDS.has(labels[labels.length - 1])) {
    return null;
  }
  const lastTwo = labels.slice(-2).join('.');
  if (MULTI_LABEL_SUFFIXES.has(lastTwo)) {
    return labels.length >= 3 ? labels.slice(-3).join('.') : null;
  }
  return lastTwo;
}
