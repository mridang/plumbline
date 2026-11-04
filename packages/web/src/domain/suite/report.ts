/**
 * @packageDocumentation
 *
 * What the app tells people on GitHub about a run: the summary of a check run
 * on a pull request's preview, and the text of the issue that tracks a site's
 * problems. These are pure functions of the findings, so they are the same
 * wherever they are shown and easy to read in a test.
 */

import { findCheck } from '@/domain/checks/catalogue';
import type { IssueLevel } from '@/domain/suite/config';
import type { StoredFinding } from '@/domain/suite/diff';

/** The most findings written out in one summary; the rest are counted. */
export const MAX_LISTED = 40;

/** The most configuration problems written out, and the longest one; the rest are counted or cut. */
export const MAX_PROBLEMS = 20;
export const MAX_PROBLEM_LENGTH = 200;

/** The longest text sent to GitHub for an issue or a check run (it accepts 65,536 characters). */
export const MAX_TEXT = 60_000;

/**
 * Text from a person's configuration file, made safe to show as Markdown on
 * GitHub: it cannot mention a user or a team, link or embed anything, or break
 * out of the line it is on, and it is no longer than a sentence.
 */
export function safeText(text: string): string {
  // Control characters and line breaks would start a new block.
  const flat = Array.from(text, (char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : char;
  })
    .join('')
    // No mention, issue reference, tag, link or code span.
    .replace(/@/g, '@\u200b')
    .replace(/#/g, '#\u200b')
    .replace(/[<>[\]`]/g, "'")
    // A bare address would become a link.
    .replace(/(https?):\/\//gi, '$1:\u200b//');
  return flat.length > MAX_PROBLEM_LENGTH
    ? `${flat.slice(0, MAX_PROBLEM_LENGTH)}...`
    : flat;
}

/** Cuts text that is over the limit GitHub accepts. */
function withinLimit(text: string): string {
  return text.length > MAX_TEXT
    ? `${text.slice(0, MAX_TEXT)}\n\n...(cut short)`
    : text;
}

/** How the summary of a check run ends in GitHub's UI. */
export type Conclusion = 'success' | 'failure' | 'neutral';

/** How many findings there are of each severity. */
export interface Counts {
  readonly errors: number;
  readonly warnings: number;
  readonly hints: number;
}

/** The findings of each severity. */
export function countsOf(findings: readonly StoredFinding[]): Counts {
  const count = (severity: StoredFinding['severity']): number =>
    findings.filter((found) => found.severity === severity).length;
  return {
    errors: count('error'),
    warnings: count('warning'),
    hints: count('hint'),
  };
}

/** `1 error` or `2 errors`. */
function amount(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Errors fail a check; warnings and hints do not. */
export function conclusionOf(findings: readonly StoredFinding[]): Conclusion {
  const { errors, warnings } = countsOf(findings);
  if (errors > 0) {
    return 'failure';
  }
  return warnings > 0 ? 'neutral' : 'success';
}

/** The findings that open (and keep open) an issue at this level. */
export function reportedFindings(
  findings: readonly StoredFinding[],
  level: IssueLevel,
): StoredFinding[] {
  if (level === 'off') {
    return [];
  }
  return findings.filter(
    (found) =>
      found.severity === 'error' ||
      (level === 'warning' && found.severity === 'warning'),
  );
}

const RANK: Readonly<Record<StoredFinding['severity'], number>> = {
  error: 0,
  warning: 1,
  hint: 2,
};

/** The findings grouped by rule, the rules with the worst findings first, as Markdown. */
export function breakdown(
  findings: readonly StoredFinding[],
  limit = MAX_LISTED,
): string {
  const byRule = new Map<string, StoredFinding[]>();
  for (const found of findings) {
    byRule.set(found.id, [...(byRule.get(found.id) ?? []), found]);
  }
  const worst = (list: readonly StoredFinding[]): number =>
    Math.min(...list.map((found) => RANK[found.severity]));
  const rules = [...byRule].toSorted(
    ([a, left], [b, right]) => worst(left) - worst(right) || a.localeCompare(b),
  );
  const lines: string[] = [];
  let listed = 0;
  for (const [id, list] of rules) {
    if (listed >= limit) {
      break;
    }
    const check = findCheck(id);
    lines.push(`#### ${check?.name ?? id} (\`${id}\`)`);
    if (check?.reference) {
      lines.push(`[Why it matters](${check.reference})`);
    }
    lines.push('');
    for (const found of list.toSorted(
      (a, b) => RANK[a.severity] - RANK[b.severity],
    )) {
      if (listed >= limit) {
        break;
      }
      lines.push(`- **${found.severity}**: ${found.message}`);
      listed += 1;
    }
    lines.push('');
  }
  if (findings.length > listed) {
    lines.push(`...and ${findings.length - listed} more.`);
  }
  return lines.join('\n').trim();
}

/** The part of a summary that says where the rules came from and what is wrong with them. */
function rulesNote(
  source: string | null,
  browserOnly: readonly string[],
  problems: readonly string[],
): string {
  const lines = [
    source
      ? `Rules from \`${source}\`.`
      : 'No `plumbline.yaml` in this repository, so the `plumbline:recommended` rules were used.',
  ];
  if (browserOnly.length > 0) {
    lines.push(
      `${amount(browserOnly.length, 'rule')} you turned on only run in the browser scan, because a Worker cannot make those checks: ${browserOnly.map((id) => `\`${id}\``).join(', ')}.`,
    );
  }
  if (problems.length > 0) {
    lines.push(
      'Problems in the configuration:',
      ...problems
        .slice(0, MAX_PROBLEMS)
        .map((problem) => `- ${safeText(problem)}`),
    );
    if (problems.length > MAX_PROBLEMS) {
      lines.push(`- ...and ${problems.length - MAX_PROBLEMS} more.`);
    }
  }
  return lines.join('\n');
}

/** What a run reports about one site, for the text below. */
export interface RunReport {
  readonly url: string;
  readonly findings: readonly StoredFinding[];
  /** The configuration file the rules came from; null when there is none. */
  readonly source: string | null;
  readonly browserOnly: readonly string[];
  readonly problems: readonly string[];
}

/** The title and Markdown of the check run that reports a preview. */
export function checkRunOutput(report: Readonly<RunReport>): {
  title: string;
  summary: string;
} {
  const host = new URL(report.url).host;
  const { errors, warnings, hints } = countsOf(report.findings);
  const title =
    report.findings.length === 0
      ? `No problems found on ${host}`
      : `${amount(errors, 'error')}, ${amount(warnings, 'warning')} and ${amount(hints, 'hint')} on ${host}`;
  const parts = [`Checked ${report.url}`];
  if (report.findings.length > 0) {
    parts.push(breakdown(report.findings));
  }
  parts.push(rulesNote(report.source, report.browserOnly, report.problems));
  return { title, summary: withinLimit(parts.join('\n\n')) };
}

/** The marker that ties an issue to a site, in the first line of its text. */
export function issueMarker(host: string): string {
  return `<!-- plumbline:${host} -->`;
}

/** The title and Markdown of the issue that tracks a site's problems. */
export function issueText(
  report: Readonly<RunReport> & { sha: string | null; level: IssueLevel },
): { title: string; body: string } {
  const host = new URL(report.url).host;
  const reported = reportedFindings(report.findings, report.level);
  const where = report.sha ? ` at commit \`${report.sha.slice(0, 7)}\`` : '';
  return {
    title: `Plumbline: ${amount(reported.length, 'problem')} on ${host}`,
    body: withinLimit(
      [
        issueMarker(host),
        `Plumbline checked ${report.url}${where} and found ${amount(reported.length, 'problem')}.`,
        breakdown(reported),
        rulesNote(report.source, report.browserOnly, report.problems),
        'This issue is updated after each deployment and closed when the problems are gone. Change which rules run, or which findings open an issue, in `plumbline.yaml`.',
      ].join('\n\n'),
    ),
  };
}
