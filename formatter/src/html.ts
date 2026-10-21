/**
 * Escaping and link helpers shared by the renderer. Everything that comes
 * from a finding, a code snippet or hint metadata goes through these before
 * it reaches the page, so the report cannot be used to inject markup.
 */

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes text for use in HTML content and in quoted attribute values.
 *
 * @param value Any text; `undefined` is treated as empty.
 * @returns The text with `& < > " '` replaced by entities.
 */
export function escapeHtml(value: string | undefined): string {
  return (value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/**
 * Returns the URL when it is safe to put in an `href`: only absolute
 * `http://` and `https://` URLs qualify, so `javascript:`, `data:` and
 * relative URLs are refused.
 *
 * @param url Candidate URL.
 * @returns The trimmed URL, or `undefined` when it must not be linked.
 */
export function safeUrl(url: string | undefined): string | undefined {
  const trimmed = (url ?? '').trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
}

/**
 * Renders an anchor for a safe URL, or the escaped text when the URL is
 * not safe to link.
 *
 * @param url Target of the link.
 * @param text Visible text; defaults to the URL itself.
 * @returns HTML for an external link or plain escaped text.
 */
export function link(url: string | undefined, text?: string): string {
  const safe = safeUrl(url);
  const label = escapeHtml(text ?? url);
  return safe
    ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    : label;
}
