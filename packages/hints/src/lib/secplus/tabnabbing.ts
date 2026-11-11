/**
 * Reverse tabnabbing analysis.
 *
 * A link that opens in a new tab with `target="_blank"` hands the opened page
 * a reference back through `window.opener`. Without `rel="noopener"` (or
 * `rel="noreferrer"`, which also severs the opener) the destination can call
 * `window.opener.location = …` and silently navigate the original tab to a
 * phishing page — "reverse tabnabbing". Modern browsers imply `noopener` for
 * `target="_blank"`, but older browsers and embedded webviews do not, so the
 * attribute is still the only portable defence.
 *
 * The rule here is the OWASP one: a cross-origin `target="_blank"` link must
 * carry `noopener` or `noreferrer`. Same-origin links cannot be used for this
 * attack and are left alone, as are links whose destination is not an HTTP(S)
 * URL (for example `mailto:` or `javascript:`).
 *
 * References:
 *   - MDN rel=noopener: https://developer.mozilla.org/docs/Web/HTML/Reference/Attributes/rel/noopener
 *   - OWASP reverse tabnabbing: https://owasp.org/www-community/attacks/Reverse_Tabnabbing.
 */
import { finding, type Finding } from '../headers/finding.js';

/** The three anchor attributes this check reads, as raw strings. */
export interface AnchorLike {
  /** The `target` attribute value, or null when absent. */
  target: string | null;
  /** The `rel` attribute value, or null when absent. */
  rel: string | null;
  /** The `href` attribute value (may be relative), or null when absent. */
  href: string | null;
}

/** Splits a `rel` value into its lower-cased, space-separated tokens. */
function relTokens(rel: string | null): Set<string> {
  return new Set(
    (rel ?? '')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token !== ''),
  );
}

/**
 * True when `href` resolves to an HTTP(S) URL on a different origin than the
 * page. A relative or same-origin link cannot be used for reverse tabnabbing,
 * and a non-HTTP scheme (`mailto:`, `tel:`, `javascript:`) opens no navigable
 * window, so both are treated as safe.
 */
export function isCrossOrigin(href: string | null, pageUrl: string): boolean {
  if (!href) {
    return false;
  }
  let page: URL;
  let target: URL;
  try {
    page = new URL(pageUrl);
  } catch {
    return false;
  }
  try {
    // Resolve against the page so a protocol-relative or absolute href is
    // normalised the same way a browser would normalise it.
    target = new URL(href, pageUrl);
  } catch {
    return false;
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return false;
  }
  return target.origin !== page.origin;
}

/** True when an anchor is an unsafe cross-origin `target="_blank"` link. */
export function isUnsafeTabnabbing(
  anchor: AnchorLike,
  pageUrl: string,
): boolean {
  // `target` is compared case-insensitively; only `_blank` opens a new tab
  // that retains an opener reference (a named target reuses an existing tab,
  // which is out of scope for this check).
  if ((anchor.target ?? '').trim().toLowerCase() !== '_blank') {
    return false;
  }
  if (!isCrossOrigin(anchor.href, pageUrl)) {
    return false;
  }
  const rel = relTokens(anchor.rel);
  return !(rel.has('noopener') || rel.has('noreferrer'));
}

/** The finding for one anchor, or null when the anchor is safe. */
export function tabnabbingFinding(
  anchor: AnchorLike,
  pageUrl: string,
): Finding | null {
  if (!isUnsafeTabnabbing(anchor, pageUrl)) {
    return null;
  }
  return finding(
    'error',
    `Link to ${anchor.href} opens in a new tab with target="_blank" but has no rel="noopener" (or "noreferrer"); the opened page can redirect this tab. Add rel="noopener".`,
  );
}

/** Findings for every anchor on the page, one per unsafe link. */
export function tabnabbingFindings(
  anchors: readonly AnchorLike[],
  pageUrl: string,
): Finding[] {
  return anchors
    .map((anchor) => tabnabbingFinding(anchor, pageUrl))
    .filter((found): found is Finding => found !== null);
}
