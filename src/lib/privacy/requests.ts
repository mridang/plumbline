import { isSameParty, registrableDomain } from './registrable-domain.js';

/** One request made while loading the page. */
export interface RequestRecord {
  url: string;
  /** Webhint resource type: `script`, `image`, `css`, `font`, ... */
  type: string;
}

/** Resource types that browsers block on an https page (active content). */
const ACTIVE_TYPES: ReadonlySet<string> = new Set([
  'script',
  'css',
  'html',
  'json',
  'xml',
  'font',
  'manifest',
]);

/** The outcome of classifying the requests of one page. */
export interface RequestReport {
  /** Registrable domain of the page, the reference for first party. */
  pageDomain: string;
  /** True when the page itself was loaded over https. */
  pageSecure: boolean;
  /** First-party requests made with plain http, on any page. */
  insecureFirstParty: RequestRecord[];
  /** Requests to hosts outside the page's registrable domain. */
  thirdParty: RequestRecord[];
  /** Unique third-party hosts in order of first appearance, unlabeled. */
  thirdPartyHosts: string[];
  secure: number;
  insecure: number;
  /** Third-party request count per resource type. */
  byType: Record<string, number>;
  /** Insecure subresources of an https page, split by blocking behaviour. */
  mixedContent: { active: RequestRecord[]; passive: RequestRecord[] };
}

/** Parses a URL, returning null for anything that is not http(s). */
export function parseWebUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * Classifies the subresource requests of a page the way Webbkoll does:
 *
 * - a third-party request goes to a host outside the page's registrable
 *   domain; they are counted as secure (`https:`) or insecure, by type and
 *   by unique host;
 * - an insecure first-party request is a plain `http:` request to the same
 *   registrable domain (Webbkoll counts them whatever the page's scheme);
 * - mixed content is any `http:` subresource of an https page.
 *
 * The page's own document must not be in `requests`.
 */
export function classifyRequests(
  pageUrl: string,
  requests: readonly RequestRecord[],
): RequestReport {
  const page = parseWebUrl(pageUrl);
  const pageHost = page?.hostname ?? '';
  const pageSecure = page?.protocol === 'https:';
  const report: RequestReport = {
    pageDomain: registrableDomain(pageHost),
    pageSecure,
    insecureFirstParty: [],
    thirdParty: [],
    thirdPartyHosts: [],
    secure: 0,
    insecure: 0,
    byType: {},
    mixedContent: { active: [], passive: [] },
  };
  const hosts = new Set<string>();
  for (const request of requests) {
    const url = parseWebUrl(request.url);
    if (!url) {
      continue; // data:, blob: and similar never leave the browser.
    }
    const insecure = url.protocol === 'http:';
    if (pageSecure && insecure) {
      const bucket = ACTIVE_TYPES.has(request.type)
        ? report.mixedContent.active
        : report.mixedContent.passive;
      bucket.push(request);
    }
    if (isSameParty(url.hostname, pageHost)) {
      // Webbkoll lists every plain http request to the page's own domain,
      // whatever the scheme of the page itself.
      if (insecure) {
        report.insecureFirstParty.push(request);
      }
      continue;
    }
    report.thirdParty.push(request);
    hosts.add(url.hostname.toLowerCase());
    if (insecure) {
      report.insecure++;
    } else {
      report.secure++;
    }
    report.byType[request.type] = (report.byType[request.type] ?? 0) + 1;
  }
  report.thirdPartyHosts = [...hosts];
  return report;
}
