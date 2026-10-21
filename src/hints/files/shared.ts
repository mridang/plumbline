import { Severity } from '@hint/utils-types';
import { splitLines, type FileIssue } from '../../lib/files/issue.js';
import type { Site } from '../../core/page.js';

const SEVERITY = {
  error: Severity.error,
  warning: Severity.warning,
  hint: Severity.hint,
} as const;

export interface CheckFileOptions {
  /** Path on the site, for example `/robots.txt`. */
  path: string;
  /** Human name used in messages. */
  label: string;
  /** Accepted media types. */
  mediaTypes: readonly string[];
  /** Severity when the file is missing. */
  missing: 'error' | 'warning' | 'hint';
  /** A minimal valid file, shown when the file is missing. */
  example(origin: string): string;
  /** Validates the body. */
  validate(text: string, url: string): FileIssue[];
}

/**
 * Fetches a site file and reports a missing file, a wrong content type or
 * encoding, and every issue the validator finds.
 * Returns true when the file was found.
 */
export async function checkFile(
  site: Site,
  o: CheckFileOptions,
): Promise<boolean> {
  const url = new URL(o.path, site.url).href;
  const data = await site.fetch(o.path);
  if (!data || data.response.statusCode !== 200) {
    const status = data ? ` (HTTP ${data.response.statusCode})` : '';
    site.report(url, `${o.label} was not found${status}.`, {
      severity: SEVERITY[o.missing],
      codeSnippet: o.example(site.origin),
    });
    return false;
  }
  const { mediaType, charset } = data.response;
  if (!o.mediaTypes.includes(mediaType.toLowerCase())) {
    site.report(
      url,
      `${o.label} is served as '${mediaType}' but should be ${o.mediaTypes.join(' or ')}.`,
      { severity: Severity.error },
    );
  }
  if (charset && !/^utf-?8$/i.test(charset)) {
    site.report(url, `${o.label} should be UTF-8 encoded, not '${charset}'.`, {
      severity: Severity.error,
    });
  }
  const body = data.response.body.content;
  const lines = splitLines(body);
  for (const issue of o.validate(body, url)) {
    const snippet = issue.snippet ?? (issue.line ? lines[issue.line - 1] : '');
    site.report(url, issue.message, {
      severity: SEVERITY[issue.severity],
      ...(issue.line
        ? {
            location: { column: 0, line: issue.line - 1 },
            ...(snippet ? { codeSnippet: snippet } : {}),
          }
        : {}),
    });
  }
  return true;
}
