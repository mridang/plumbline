/**
 * Readers for the favicons a page declares with `<link rel="icon">`.
 */
import type { DocumentLike } from './read.js';

/** One declared icon. */
export interface IconLink {
  href: string;
  type: string;
  sizes: string;
}

/**
 * Returns every `<link>` whose `rel` contains the `icon` token (so
 * `icon` and `shortcut icon`, but not `apple-touch-icon`).
 */
export function getIconLinks(doc: DocumentLike): IconLink[] {
  return doc
    .querySelectorAll('link[rel~="icon" i][href]')
    .map((element) => ({
      href: (element.getAttribute('href') ?? '').trim(),
      type: (element.getAttribute('type') ?? '').trim().toLowerCase(),
      sizes: (element.getAttribute('sizes') ?? '').trim().toLowerCase(),
    }))
    .filter((icon) => icon.href !== '');
}

/** The path of an icon URL without query string or fragment, lower-cased. */
function pathOf(href: string): string {
  return href.split(/[?#]/, 1)[0].toLowerCase();
}

/** True for an SVG icon, by MIME type or file extension. */
export function isSvgIcon(icon: IconLink): boolean {
  return icon.type === 'image/svg+xml' || pathOf(icon.href).endsWith('.svg');
}

/** True for an `.ico` icon, by MIME type or file extension. */
export function isIcoIcon(icon: IconLink): boolean {
  return (
    icon.type === 'image/x-icon' ||
    icon.type === 'image/vnd.microsoft.icon' ||
    pathOf(icon.href).endsWith('.ico')
  );
}

/** True for a PNG icon, by MIME type or file extension. */
export function isPngIcon(icon: IconLink): boolean {
  return icon.type === 'image/png' || pathOf(icon.href).endsWith('.png');
}

/** True for a PNG icon that declares a 32x32 size. */
export function isPng32Icon(icon: IconLink): boolean {
  return isPngIcon(icon) && icon.sizes.split(/\s+/).includes('32x32');
}
