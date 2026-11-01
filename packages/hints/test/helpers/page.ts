import type { Routes } from './run-hint.js';

/** Parts of the one HTML page served at `/` (and at any `path`). */
export interface PageParts {
  title?: string;
  /** Inserted into <head>. */
  head?: string;
  /** Inserted into <body>; defaults to a heading. */
  body?: string;
  status?: number;
  headers?: Record<string, string>;
}

/**
 * Builds the routes for a valid page, so only the rule under test can fail.
 * `path` serves the same page at another path, for rules about the URL.
 */
export function htmlPage(parts: PageParts = {}, path = '/'): Routes {
  const route = {
    status: parts.status ?? 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      ...parts.headers,
    },
    body: `<!doctype html><html lang="en"><head><title>${parts.title ?? 'A fine page title'}</title>${parts.head ?? ''}</head><body>${parts.body ?? '<h1>Heading</h1>'}</body></html>`,
  };
  return path === '/' ? { '/': route } : { '/': route, [path]: route };
}
