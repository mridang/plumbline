/**
 * @packageDocumentation
 *
 * What differs from one app to the next in the shared HTTP code (`headers.ts`,
 * `csp.ts`, `edge-limits.ts`, `edge-cache.ts`): the pages search engines may
 * index, the pages the edge may keep a copy of (with the query names they may
 * carry and for how long), the files other sites may load, the small files
 * that may be cached for a day, the files the edge limits do not count or count
 * as discovery, and the few outside places and extra rules a page's policy
 * needs. Everything else in those files is the same in every app.
 */

/** The pages search engines may index: the one page, which is a public demo. */
export const PUBLIC_PAGES: ReadonlySet<string> = new Set(['/']);

/**
 * The pages the Worker may keep a copy of at the edge and answer without waking
 * the app. The page is the same for everyone (the scan runs from the browser
 * through the API), so it is kept.
 */
export const EDGE_CACHED_PAGES: ReadonlySet<string> = new Set(['/']);

/**
 * The query parameter names a kept page may carry. A request with any other
 * name is never kept, and the copy is keyed by these parameters alone. The page
 * reads one: the domain to scan straight away, so a result can be linked to.
 */
export const CACHED_QUERY_PARAMS: ReadonlySet<string> = new Set(['domain']);

/** How long the edge may keep a page before asking the app again, in seconds. */
export const EDGE_TTL_SECONDS = 1800;

/**
 * The files other sites and browsers fetch on purpose (the icons and the
 * plain-text files at the root), which any site may load and which are not
 * marked noindex.
 */
export const OPEN_FILES =
  /^\/(icon\.svg|favicon\.ico|robots\.txt|sitemap\.xml|\.well-known\/.*)$/;

/** The small files that rarely change, and for which a stale copy is harmless. */
export const RARELY_CHANGING: ReadonlySet<string> = new Set([
  '/icon.svg',
  '/favicon.ico',
]);

/**
 * The outside places pages may load pictures from, besides this site (`'self'`)
 * and inline `data:` pictures. None: the page draws its icons inline.
 */
export const EXTRA_IMG_SOURCES: readonly string[] = [];

/** Directives only this app adds to its policy. None. */
export const EXTRA_DIRECTIVES: readonly string[] = [];

/** Paths served as static files: nothing to protect, and a page loads dozens of them. */
export const STATIC_PREFIXES: readonly string[] = ['/_next/'];

/** The files at the root that are read by crawlers and cost nothing to serve. */
export const DISCOVERY_PATHS: ReadonlySet<string> = new Set([
  '/robots.txt',
  '/sitemap.xml',
]);

/**
 * A cache rule for pages that differ from the default `private, no-cache`,
 * keyed by path. None.
 */
export const PAGE_CACHE_RULES: Readonly<Record<string, string>> = {};
