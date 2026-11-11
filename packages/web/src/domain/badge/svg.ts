/**
 * @packageDocumentation
 *
 * A flat two-part badge as SVG, in the style of the badges a README usually
 * carries: a grey label on the left and a coloured value on the right. The
 * width of each part is estimated from the text, because there is no font to
 * measure in a Worker; 6.5 pixels a character at 11 px Verdana is close.
 */

/** Text made safe to place inside SVG. */
function escapeText(text: string): string {
  return text.replaceAll(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char] ?? char,
  );
}

/** The width of a part holding `text`, in pixels. */
function widthOf(text: string): number {
  return Math.round(text.length * 6.5 + 12);
}

/** A badge with `label` on the left and `value` on the right, in `colour`. */
export function badgeSvg(label: string, value: string, colour: string): string {
  const left = widthOf(label);
  const right = widthOf(value);
  const width = left + right;
  const title = escapeText(`${label}: ${value}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${title}"><title>${title}</title><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath><g clip-path="url(#r)"><rect width="${left}" height="20" fill="#555"/><rect x="${left}" width="${right}" height="20" fill="${escapeText(colour)}"/><rect width="${width}" height="20" fill="url(#s)"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11"><text x="${left / 2}" y="14">${escapeText(label)}</text><text x="${left + right / 2}" y="14">${escapeText(value)}</text></g></svg>`;
}
