import { severityRank } from './exit-code.js';
import type { Finding, Report } from './report.js';
import type { HintMeta } from './scan.js';

/** One finding as `plumbline scan --format json` prints it. */
export interface JsonFinding {
  /** The bare hint id, the same form `--only` and `--skip` take. */
  hint: string;
  severity: string;
  message: string;
  resource: string;
  codeSnippet?: string;
}

/** One catalogue entry as `plumbline checks --format json` prints it. */
export interface JsonCheck {
  id: string;
  name: string;
  groups: string[];
  description: string;
}

/** Findings carry the `extra/<id>` key webhint reports; the CLI shows bare ids. */
function bareId(hintId: string): string {
  return hintId.replace(/^extra\//, '');
}

/** Most serious first, then by hint id, so output is stable between runs. */
function bySeverity(a: Finding, b: Finding): number {
  return (
    severityRank(b.severity) - severityRank(a.severity) ||
    a.hintId.localeCompare(b.hintId)
  );
}

/**
 * Flattens a report into the machine-readable list of findings, most serious
 * first. Optional fields are left out rather than set to `undefined`, so the
 * JSON stays small and predictable.
 *
 * @param report The scan's report.
 * @returns One entry per finding.
 */
export function toJsonFindings(report: Report): JsonFinding[] {
  return [...report.findings].sort(bySeverity).map((finding) => ({
    hint: bareId(finding.hintId),
    severity: finding.severity,
    message: finding.message,
    resource: finding.resource,
    ...(finding.codeSnippet ? { codeSnippet: finding.codeSnippet } : {}),
  }));
}

/** `1 error`, `2 warnings`: a count with its noun. */
function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** The closing line of a text report, also used after an HTML report. */
export function summaryLine(report: Report, checksRun: number): string {
  const { error, warning, hint, information, total } = report.summary;
  if (total === 0) {
    return `No findings from ${plural(checksRun, 'check')} on ${report.url}`;
  }
  return (
    `${plural(total, 'finding')} from ${plural(checksRun, 'check')} on ` +
    `${report.url}: ${plural(error, 'error')}, ${plural(warning, 'warning')}, ` +
    `${plural(hint, 'hint')}, ${information} information`
  );
}

/** Indents every line of a multi-line block (code snippets). */
function indent(text: string, by: string): string {
  return text
    .split('\n')
    .map((line) => `${by}${line}`)
    .join('\n');
}

/**
 * Renders the report for a terminal: one block per hint with findings, the
 * hint with the most serious finding first, each finding with its severity,
 * message, the resource it is about when that is not the page itself, and its
 * code snippet. A summary line closes the report.
 *
 * @param report The scan's report.
 * @param hints The catalogue entries of the hints that ran, for their names.
 * @returns The text to print, ending in a newline.
 */
export function formatFindings(
  report: Report,
  hints: readonly HintMeta[],
): string {
  const groups = new Map<string, Finding[]>();
  for (const finding of [...report.findings].sort(bySeverity)) {
    const id = bareId(finding.hintId);
    groups.set(id, [...(groups.get(id) ?? []), finding]);
  }
  // Map keeps insertion order, and findings were inserted most serious
  // first, so hints come out ordered by their worst finding.
  const blocks = [...groups].map(([id, findings]) => {
    const name = hints.find((hint) => hint.id === id)?.name;
    const heading = name && name !== id ? `${id} (${name})` : id;
    const lines = findings.map((finding) => {
      const parts = [`  ${finding.severity.padEnd(11)} ${finding.message}`];
      if (finding.resource && finding.resource !== report.url) {
        parts.push(`  ${''.padEnd(11)} at ${finding.resource}`);
      }
      if (finding.codeSnippet) {
        parts.push(indent(finding.codeSnippet, `  ${''.padEnd(11)} | `));
      }
      return parts.join('\n');
    });
    return [heading, ...lines].join('\n');
  });
  return [...blocks, summaryLine(report, hints.length)].join('\n\n') + '\n';
}

/**
 * Renders the catalogue for a terminal: each check's id and name, its groups,
 * and its description, with a count at the end.
 *
 * @param checks The catalogue entries to list.
 * @returns The text to print, ending in a newline.
 */
export function formatChecks(checks: readonly HintMeta[]): string {
  const blocks = checks.map((check) =>
    [
      `${check.id}  ${check.name}`,
      `  groups: ${check.groups.join(', ') || '(none)'}`,
      ...(check.description ? [`  ${check.description}`] : []),
    ].join('\n'),
  );
  return [...blocks, plural(checks.length, 'check')].join('\n\n') + '\n';
}

/** The catalogue as `plumbline checks --format json` prints it. */
export function toJsonChecks(checks: readonly HintMeta[]): JsonCheck[] {
  return checks.map(({ id, name, groups, description }) => ({
    id,
    name,
    groups,
    description,
  }));
}
