import type { Routes } from '../../helpers/run-hint.js';

/**
 * Builds the routes for a test scan: `/` is an HTML page whose head holds
 * the given meta tags, and `extra` adds more paths (for example images).
 */
export function page(head: string, extra: Routes = {}): Routes {
  return {
    '/': {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body></body></html>`,
    },
    ...extra,
  };
}
