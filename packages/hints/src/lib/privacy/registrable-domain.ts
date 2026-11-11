import { domainToASCII } from '#url';

/**
 * A small, dependency free stand-in for the Public Suffix List.
 *
 * Webbkoll decides whether a request is first party by comparing the
 * registrable domain (the "eTLD+1", for example `example.co.uk`) of the page
 * and of the request. The full list is large and changes often, so this
 * module uses a documented heuristic instead:
 *
 * 1. IP addresses, `localhost` and single label hosts are their own domain.
 * 2. Otherwise the registrable domain is the last two labels, or the last
 *    three when the last two form a known multi label public suffix. The
 *    suffix is recognised either from `MULTI_LABEL_SUFFIXES` (a short list of
 *    common ones, including a few shared hosting suffixes) or from the usual
 *    country code pattern of a generic second label such as `co`, `com`,
 *    `org`, `net`, `gov`, `edu` or `ac` below a two letter country code.
 *
 * It is wrong for rare suffixes, which is acceptable for an advisory hint.
 */

/** Public suffixes with more than one label that the pattern does not cover. */
const MULTI_LABEL_SUFFIXES: ReadonlySet<string> = new Set([
  // Shared hosting where every customer is a separate party.
  'github.io',
  'gitlab.io',
  'herokuapp.com',
  'netlify.app',
  'vercel.app',
  'pages.dev',
  'workers.dev',
  'web.app',
  'firebaseapp.com',
  'appspot.com',
  'blogspot.com',
  'cloudfront.net',
  'azurewebsites.net',
  's3.amazonaws.com',
  'elasticbeanstalk.com',
  'surge.sh',
  'glitch.me',
  'onrender.com',
  'fly.dev',
  'github.dev',
  'ngrok.io',
  'readthedocs.io',
  'pythonanywhere.com',
  'myshopify.com',
  'compute.amazonaws.com',
  'execute-api.us-east-1.amazonaws.com',
]);

/** Generic second level labels used below country code top level domains. */
const GENERIC_SECOND_LEVEL: ReadonlySet<string> = new Set([
  'co',
  'com',
  'org',
  'net',
  'gov',
  'edu',
  'ac',
  'or',
  'ne',
  'go',
  'gob',
  'mil',
  'nom',
  'ltd',
  'plc',
  'sch',
  'me',
  'ad',
  'ed',
  'gr',
  'lg',
]);

/** True for dotted IPv4 and for IPv6 literals (with or without brackets). */
export function isIpAddress(host: string): boolean {
  const bare = host.replaceAll(/^\[|\]$/g, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bare)) {
    return true;
  }
  return bare.includes(':') && /^[0-9a-f:.]+$/i.test(bare);
}

/** Removes every trailing dot, scanning once from the end. */
function stripTrailingDots(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === '.') {
    end -= 1;
  }
  return value.slice(0, end);
}

/** Lower cases a host and removes trailing dots and IPv6 brackets. */
export function normalizeHost(host: string): string {
  const cleaned = stripTrailingDots(host.trim().toLowerCase())
    .replace(/^\.+/, '')
    .replaceAll(/^\[|\]$/g, '');
  // Hosts from URLs are already punycode; a `Domain` attribute may carry
  // Unicode, which must compare equal to its punycode form.
  return /[^\u0020-\u007E]/.test(cleaned)
    ? domainToASCII(cleaned) || cleaned
    : cleaned;
}

/**
 * Returns the registrable domain of a host, following the heuristic in the
 * module comment. Hosts that are IP addresses or have one label are returned
 * unchanged, which also covers the case where a site is served directly at a
 * public suffix, as Webbkoll does.
 */
export function registrableDomain(host: string): string {
  const normalized = normalizeHost(host);
  if (isIpAddress(normalized)) {
    return normalized;
  }
  const labels = normalized.split('.').filter((label) => label.length > 0);
  if (labels.length <= 2) {
    return labels.join('.');
  }
  const top = labels.at(-1) ?? '';
  const second = labels.at(-2) ?? '';
  // Longest known suffix wins: a listed suffix may have any number of labels
  // (`s3.amazonaws.com` has three), so every tail of the host is tried.
  let suffixLength = 1;
  for (let length = labels.length; length >= 2; length--) {
    if (MULTI_LABEL_SUFFIXES.has(labels.slice(-length).join('.'))) {
      suffixLength = length;
      break;
    }
  }
  if (
    suffixLength === 1 &&
    top.length === 2 &&
    GENERIC_SECOND_LEVEL.has(second)
  ) {
    suffixLength = 2;
  }
  // The registrable domain is one label more than the public suffix. A host
  // that is itself a public suffix is returned whole, as Webbkoll does.
  return labels.slice(-Math.min(suffixLength + 1, labels.length)).join('.');
}

/** True when two hosts share a registrable domain. */
export function isSameParty(hostA: string, hostB: string): boolean {
  return registrableDomain(hostA) === registrableDomain(hostB);
}
