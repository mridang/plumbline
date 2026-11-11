/**
 * Helpers shared by the header hints: the `profile` option, and the glue that
 * turns the findings of `src/lib/headers` into webhint reports.
 */
import type { HintMetadata, ReportOptions } from 'hint';
import { Severity } from '@hint/utils-types';
import type {
  Finding,
  FindingSeverity,
  Profile,
} from '../../lib/headers/finding.js';
import type { Page, Site } from '../../core/page.js';

/**
 * Option schema of the hints that have two rule sets: `observatory` (the
 * default, lenient values from Mozilla Observatory) and `owasp` (the stricter
 * values of the OWASP Secure Headers Project).
 */
export const PROFILE_SCHEMA: HintMetadata['schema'] = [
  {
    additionalProperties: false,
    properties: {
      profile: { enum: ['observatory', 'owasp'], type: 'string' },
    },
    type: 'object',
  },
];

/** Reads the `profile` option, defaulting to `observatory`. */
export function readProfile(options: unknown): Profile {
  const profile = (options as { profile?: unknown } | undefined)?.profile;
  return profile === 'owasp' ? 'owasp' : 'observatory';
}

const SEVERITIES: Record<FindingSeverity, Severity> = {
  error: Severity.error,
  warning: Severity.warning,
  hint: Severity.hint,
};

/** The header shown next to a finding as a code snippet. */
export interface Snippet {
  /** Header name; leave out when `lines` is given. */
  name?: string;
  /** Header lines already rendered, for findings that span several headers. */
  lines?: string[];
  /** The value(s) received; one line per entry; null or empty when absent. */
  value?: string | string[] | null;
  /** The recommended value, shown as the header to add when none was sent. */
  suggest?: string;

  /**
   * The `<meta>` the policy was declared in. Webhint then derives the line,
   * column and code from the element, so no header line is added.
   */
  element?: ReportOptions['element'];
}

function options(
  severity: FindingSeverity,
  snippet?: Snippet,
): Partial<ReportOptions> {
  const values = [snippet?.value ?? []].flat().filter((v) => v !== '');
  let lines: string[];
  if (snippet?.lines) {
    lines = snippet.lines;
  } else if (values.length > 0) {
    lines = values.map((value) => `${snippet?.name}: ${value}`);
  } else if (snippet?.suggest === undefined) {
    lines = [];
  } else {
    lines = [`${snippet.name}: ${snippet.suggest}`];
  }
  if (snippet?.element) {
    return { severity: SEVERITIES[severity], element: snippet.element };
  }
  return {
    severity: SEVERITIES[severity],
    ...(lines.length > 0
      ? { codeLanguage: 'http', codeSnippet: lines.join('\n') }
      : {}),
  };
}

/** Reports findings against the scanned page. */
export function reportFindings(
  page: Page,
  findings: Finding[],
  snippet?: Snippet,
): void {
  for (const { message, severity } of findings) {
    page.report(message, options(severity, snippet));
  }
}

/** Reports findings against a resource of the site. */
export function reportSiteFindings(
  site: Site,
  resource: string,
  findings: Finding[],
  snippet?: Snippet,
): void {
  for (const { message, severity } of findings) {
    site.report(resource, message, options(severity, snippet));
  }
}

/** True when the page was served over HTTPS. */
export function isSecure(url: string): boolean {
  return url.startsWith('https:');
}
