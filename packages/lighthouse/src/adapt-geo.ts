/**
 * Set-specific adapter for the `geo` checks. As with `adapt.ts`, nothing here
 * re-implements a check: it reshapes the `MainDocumentContent` artifact (the
 * served HTML) into the structural input the reused `src/lib/geo/**` functions
 * already accept.
 *
 * Lighthouse exposes no parsed artifact for either kind of data these checks
 * read. The `Scripts` artifact comes from the debugger, which only sees
 * executable JavaScript, so `<script type="application/ld+json">` blocks are
 * absent from it; and there is no artifact describing the body's paragraph and
 * heading structure. Both are therefore read from the served HTML.
 *
 * The HTML is parsed once with `@hint/utils-dom`'s `createHTMLDocument` — the
 * exact parser webhint feeds the geo hints. The resulting document satisfies
 * both `JsonLdDocument` (its `querySelectorAll('script[type=…]')` yields the
 * JSON-LD blocks, each with the `textContent` `readJsonLd` parses) and
 * `ContentDocument` (`measureContent` walks `<main>`/`<body>`, counts headings
 * and paragraphs, and finds an unstructured `<div>` over it), so a page yields
 * the same findings here as under the webhint hint by construction.
 *
 * This replaces two hand-rolled parsers: a flat `<script>` scanner and a small
 * nested-tree builder whose raw-text skip, written with a non-global RegExp,
 * could rewind its cursor onto an earlier `</script>` and loop forever on a page
 * with several `<script>` tags. A real parser removes that whole class of bug.
 */
import { createHTMLDocument } from '@hint/utils-dom';
import type { JsonLdDocument } from '@mridang/webhint-hint-plumbline/dist/lib/geo/json-ld.js';
import type { ContentDocument } from '@mridang/webhint-hint-plumbline/dist/lib/geo/content.js';

/**
 * Parses the served HTML into a real document that satisfies both the
 * {@link JsonLdDocument} and {@link ContentDocument} shapes the geo library
 * functions take. `base` is the page URL (unused by these checks, which read no
 * URLs, but passed so the parser resolves against the right origin).
 */
export function geoDocument(
  html: string,
  base: string,
): JsonLdDocument & ContentDocument {
  return createHTMLDocument(html, base) as unknown as JsonLdDocument &
    ContentDocument;
}
