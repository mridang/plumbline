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
  const parsed = requests.flatMap((request) => {
    const url = parseWebUrl(request.url);
    // data:, blob: and similar never leave the browser.
    return url
      ? [
          {
            request,
            url,
            insecure: url.protocol === 'http:',
            sameParty: isSameParty(url.hostname, pageHost),
          },
        ]
      : [];
  });
  const mixed = parsed.filter(({ insecure }) => pageSecure && insecure);
  const thirdParty = parsed.filter(({ sameParty }) => !sameParty);
  return {
    pageDomain: registrableDomain(pageHost),
    pageSecure,
    // Webbkoll lists every plain http request to the page's own domain,
    // whatever the scheme of the page itself.
    insecureFirstParty: parsed.flatMap(({ request, sameParty, insecure }) =>
      sameParty && insecure ? [request] : [],
    ),
    thirdParty: thirdParty.map(({ request }) => request),
    thirdPartyHosts: [
      ...new Set(thirdParty.map(({ url }) => url.hostname.toLowerCase())),
    ],
    secure: thirdParty.filter(({ insecure }) => !insecure).length,
    insecure: thirdParty.filter(({ insecure }) => insecure).length,
    byType: Object.fromEntries(
      Array.from(
        Map.groupBy(thirdParty, ({ request }) => request.type),
        ([type, group]) => [type, group.length],
      ),
    ),
    mixedContent: {
      active: mixed.flatMap(({ request }) =>
        ACTIVE_TYPES.has(request.type) ? [request] : [],
      ),
      passive: mixed.flatMap(({ request }) =>
        ACTIVE_TYPES.has(request.type) ? [] : [request],
      ),
    },
  };
}
