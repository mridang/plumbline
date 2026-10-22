import { Severity } from '@hint/utils-types';
import type { Site } from '../../core/page.js';

/**
 * Fetches a path and returns its body only when the server answered `200`.
 * A `404`, a redirect, a `403` or a failed request all mean "not exposed",
 * so the caller treats a `null` result as a pass. The body is returned as the
 * decoded string (webhint also keeps the raw bytes, but every exposure check
 * works on the text form, including the binary-signature ones whose bytes are
 * all in the ASCII range).
 */
export async function fetchIfReachable(
  site: Site,
  path: string,
): Promise<string | null> {
  const data = await site.fetch(path);
  if (!data || data.response.statusCode !== 200) {
    return null;
  }
  return data.response.body.content;
}

/**
 * Reports a reachable, confirmed exposure against the probed URL as an error.
 * The offending path is the resource; the first line of the body is attached
 * as evidence so the report shows what was leaked without dumping the file.
 */
export function reportExposure(
  site: Site,
  path: string,
  message: string,
  evidence?: string,
): void {
  const url = new URL(path, site.url).href;
  const snippet = evidence?.split(/\r?\n/, 1)[0]?.slice(0, 200);
  site.report(url, message, {
    severity: Severity.error,
    ...(snippet ? { codeSnippet: snippet } : {}),
  });
}
