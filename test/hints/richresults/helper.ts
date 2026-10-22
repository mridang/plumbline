import type { Routes } from '../../helpers/run-hint.js';

/** Serves a page whose <head> holds the given JSON-LD objects as blocks. */
export function page(...values: unknown[]): Routes {
  const scripts = values
    .map(
      (value) =>
        `<script type="application/ld+json">${JSON.stringify(value)}</script>`,
    )
    .join('');
  return {
    '/': {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: `<!doctype html><html lang="en"><head><title>A fine page title</title>${scripts}</head><body><h1>Heading</h1></body></html>`,
    },
  };
}
