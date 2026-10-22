/**
 * Readers that pull the Progressive-Web-App install signals out of a parsed
 * HTML document. They read only the tiny slice of the DOM described below, so
 * they can be unit tested without running a scan and reused unchanged by the
 * Lighthouse plugin (which reshapes its artifacts into the same shape).
 *
 * Two facts live in the DOM rather than in the manifest itself: the
 * `<link rel="manifest">` that points at the manifest (install discovery), and
 * the `<meta name="theme-color">` that themes the browser UI and address bar
 * before the manifest is fetched. Everything else about a manifest is read
 * from the fetched JSON document by `./manifest.ts`.
 */

/** The part of a DOM element these readers use. */
interface ElementLike {
  textContent: string;
  getAttribute(name: string): string | null;
}

/** The part of a DOM document these readers use. */
export interface DocumentLike {
  querySelector(selector: string): ElementLike | null;
  querySelectorAll(selector: string): ElementLike[];
}

/**
 * Returns the trimmed `href` of the first `<link rel="manifest">`, or null when
 * the page declares none (or declares one with an empty `href`). The `rel`
 * token match is case-insensitive and tolerates extra tokens
 * (`rel="manifest foo"`), mirroring how browsers resolve the manifest link.
 */
export function getManifestHref(doc: DocumentLike): string | null {
  const element = doc.querySelector('link[rel~="manifest" i]');
  if (!element) {
    return null;
  }
  const href = (element.getAttribute('href') ?? '').trim();
  return href === '' ? null : href;
}

/**
 * True when the manifest link's `href` is an absolute reference rather than a
 * document-relative one. A full URL (`https://…`), a protocol-relative URL
 * (`//…`) and a root-relative path (`/manifest.webmanifest`) all resolve the
 * same way wherever the page is served; a document-relative reference
 * (`manifest.json`, `./manifest.json`) does not, which the manifest-linked
 * rule flags.
 */
export function isAbsoluteHref(href: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(href) || href.startsWith('/');
}

/**
 * Returns the trimmed `content` of the first `<meta name="theme-color">`, or
 * null when the tag is absent or carries an empty value. A `media`-scoped
 * theme-color (`<meta name="theme-color" media="(prefers-color-scheme: dark)">`)
 * still counts: the presence of any theme-color meta is what the rule checks.
 */
export function getThemeColorMeta(doc: DocumentLike): string | null {
  const element = doc.querySelector('meta[name="theme-color" i]');
  if (!element) {
    return null;
  }
  const content = (element.getAttribute('content') ?? '').trim();
  return content === '' ? null : content;
}
