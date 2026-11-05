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
function rulesNote(source: string | null, problems: readonly string[]): string {
  const lines = [
    source
      ? `Rules from \`${source}\`.`
      : 'No `plumbline.yaml` in this repository, so the `plumbline:recommended` rules were used.',
  ];
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

/** The most findings the summary of a check lists; the full list is in its text and in the report. */
export const SUMMARY_LISTED = 5;

/** The most findings written into the machine-readable block of a check. */
export const MAX_DATA = 100;

/** What a run reports about one site, for the text below. */
export interface RunReport {
  readonly url: string;
  readonly findings: readonly StoredFinding[];
  /** The configuration file the rules came from; null when there is none. */
  readonly source: string | null;
  readonly problems: readonly string[];
  /** Where the full report can be opened without signing in. */
  readonly reportUrl?: string;
  /** The same report as JSON. */
  readonly dataUrl?: string;
}

/**
 * The findings as JSON for a tool (a coding agent reading a failed check), with
 * the text of each finding as the site gave it, made safe to sit inside a code
 * fence. Cut to {@link MAX_DATA} findings so it stays valid JSON.
 */
export function dataBlock(report: Readonly<RunReport>): string {
  const counts = countsOf(report.findings);
  const json = JSON.stringify(
    {
      version: 1,
      url: report.url,
      conclusion: conclusionOf(report.findings),
      ...counts,
      report: report.reportUrl ?? null,
      json: report.dataUrl ?? null,
      truncated: report.findings.length > MAX_DATA,
      findings: report.findings.slice(0, MAX_DATA).map((found) => ({
        id: found.id,
        name: findCheck(found.id)?.name ?? found.id,
        severity: found.severity,
        message: found.message,
        reference: findCheck(found.id)?.reference ?? null,
      })),
    },
    null,
    1,
  ).replace(/`/g, '\\u0060');
  return `\`\`\`json\n${json}\n\`\`\``;
}

/**
 * The title, a short summary and the full text of the check run that reports a
 * preview. The summary says what was found in a few lines and links to the
 * report; the text has every finding by rule, then the same findings as JSON, so
 * whoever reads the check (a person, or an agent with only the GitHub API) has
 * everything without signing in anywhere.
 */
export function checkRunOutput(report: Readonly<RunReport>): {
  title: string;
  summary: string;
  text: string;
} {
  const host = new URL(report.url).host;
  const { errors, warnings, hints } = countsOf(report.findings);
  const title =
    report.findings.length === 0
      ? `No problems found on ${host}`
      : `${amount(errors, 'error')}, ${amount(warnings, 'warning')} and ${amount(hints, 'hint')} on ${host}`;
  const parts = [`Checked ${report.url}`];
  if (report.reportUrl) {
    parts.push(`[Open the full report](${report.reportUrl})`);
  }
  if (report.findings.length > 0) {
    const worst = report.findings
      .toSorted((a, b) => RANK[a.severity] - RANK[b.severity])
      .slice(0, SUMMARY_LISTED);
    const more = report.findings.length - worst.length;
    parts.push(
      [
        ...worst.map((found) => `- **${found.severity}**: ${found.message}`),
        ...(more > 0 ? [`- ...and ${more} more in the report.`] : []),
      ].join('\n'),
    );
  }
  parts.push(rulesNote(report.source, report.problems));
  const text = [
    report.findings.length > 0 ? breakdown(report.findings) : 'Nothing found.',
    dataBlock(report),
  ].join('\n\n');
  return {
    title,
    summary: withinLimit(parts.join('\n\n')),
    text: withinLimit(text),
  };
}

/** The most findings written into the issue of one check; the rest are counted. */
export const MAX_ISSUE_FINDINGS = 10;

/** The marker that ties an issue to a check of a site, in the first line of its text. */
export function issueMarker(host: string, check: string): string {
  return `<!-- plumbline:${host}:${check} -->`;
}

/** The `plumbline.yaml` lines that turn one check off, as a fenced block. */
export function offSnippet(check: string): string {
  return ['```yaml', 'rules:', `  ${check}: off`, '```'].join('\n');
}

/** Where the rules are, as a Markdown link when the file and commit are known. */
function rulesLink(
  repo: string,
  source: string | null,
  sha: string | null,
): string {
  const file = source ?? 'plumbline.yaml';
  return source
    ? `[\`${source}\`](https://github.com/${repo}/blob/${sha ?? 'HEAD'}/${source})`
    : `\`${file}\``;
}

/** What is needed to write the issue of one check. */
export interface CheckIssueInput {
  readonly repo: string;
  readonly host: string;
  readonly url: string;
  readonly sha: string | null;
  /** The check's id. */
  readonly check: string;
  /** What it found, at the level that opens an issue. */
  readonly findings: readonly StoredFinding[];
  readonly source: string | null;
  /** What is wrong with the configuration file, one sentence each. */
  readonly problems?: readonly string[];
  /** Where the app shows the repository's results, when known. */
  readonly pageUrl?: string;
}

/** The title and Markdown of the issue that tracks one check of a site. */
export function checkIssueText(input: Readonly<CheckIssueInput>): {
  title: string;
  body: string;
} {
  const check = findCheck(input.check);
  const name = check?.name ?? input.check;
  const where = input.sha ? ` at commit \`${input.sha.slice(0, 7)}\`` : '';
  const listed = input.findings
    .toSorted((a, b) => RANK[a.severity] - RANK[b.severity])
    .slice(0, MAX_ISSUE_FINDINGS);
  const more = input.findings.length - listed.length;
  const fix = [
    check?.description,
    check?.fixer ? `This is usually fixed in the ${check.fixer}.` : undefined,
    check?.reference ? `[Why it matters](${check.reference})` : undefined,
  ].filter((part): part is string => part !== undefined && part !== '');
  const body = [
    issueMarker(input.host, input.check),
    `Plumbline checked ${input.url}${where} and found ${amount(input.findings.length, 'problem')} for **${name}**.`,
    [
      ...listed.map(
        (found) => `- **${found.severity}**: ${safeText(found.message)}`,
      ),
      ...(more > 0 ? [`- ...and ${more} more.`] : []),
    ].join('\n'),
    ['### How to fix', ...(fix.length > 0 ? [fix.join(' ')] : [])].join('\n\n'),
    [
      '### Not needed?',
      `If you do not need this check, turn it off in ${rulesLink(input.repo, input.source, input.sha)}, in the root of the repository:`,
      offSnippet(input.check),
      'The next deployment closes this issue by itself.',
      rulesNote(input.source, input.problems ?? []),
    ].join('\n\n'),
    [
      'Plumbline keeps one issue for each check of each site. It updates this one when the problem changes and closes it when the problem is gone. Please leave it open until then.',
      input.pageUrl ? `[Open the results](${input.pageUrl})` : undefined,
    ]
      .filter((part): part is string => part !== undefined)
      .join('\n\n'),
  ].join('\n\n');
  return {
    title: `[Plumbline] ${name} on ${input.host}`,
    body: withinLimit(body),
  };
}

/** Why the app closed an issue on its own. */
export type CloseReason =
  /** The check no longer finds the problem. */
  | 'fixed'
  /** The rules turned the check off. */
  | 'off'
  /** The rules still run the check, but what it finds no longer opens an issue. */
  | 'level'
  /** The check is not in the catalogue any more. */
  | 'removed'
  /** The site is no longer deployed by the repository. */
  | 'undeployed';

/** The comment that goes with closing an issue. */
export function closingComment(
  reason: CloseReason,
  input: Readonly<{
    repo: string;
    host: string;
    source: string | null;
    sha: string | null;
    /** Where the fix came in: a pull request or a commit. */
    where: string;
  }>,
): string {
  const rules = rulesLink(input.repo, input.source, input.sha);
  switch (reason) {
    case 'fixed':
      return `Plumbline no longer finds this problem as of ${input.where}, so this issue is closed. It opens again if the problem comes back.`;
    case 'off':
      return `This check is turned off by the rules in ${rules}, so Plumbline stopped tracking it and closed this issue. If you turn it on again and the problem is still there, a new issue is opened.`;
    case 'level':
      return `What this check finds no longer opens an issue under the rules in ${rules}, so this issue is closed. The results in Plumbline still show it.`;
    case 'removed':
      return 'Plumbline no longer has this check, so this issue is closed.';
    case 'undeployed':
      return `${input.host} is no longer deployed from this repository, so Plumbline stopped checking it and closed this issue.`;
  }
}

/** The comment when a person closed an issue while the problem is still there and the app reopened it. */
export function reopenedComment(check: string, host: string): string {
  return [
    `Please do not close this issue: it tracks the **${findCheck(check)?.name ?? check}** check on ${host} and stays open while the problem is there. Plumbline closes it itself once the problem is gone.`,
    `If you do not need this check, turn it off in \`plumbline.yaml\` instead:`,
    offSnippet(check),
    'The next deployment closes this issue by itself.',
  ].join('\n\n');
}

/** The comment when a person closed the issue again and again, and the app stops reopening it. */
export function leftClosedComment(check: string): string {
  return [
    'This issue was closed again while the problem is still there, so Plumbline will leave it closed and will not reopen it. The problem is still reported in Plumbline.',
    `To stop checking it, turn it off in \`plumbline.yaml\`:`,
    offSnippet(check),
  ].join('\n\n');
}

/** The comment on the last issue opened in a run, when more problems than the limit were found. */
export function deferredComment(deferred: number): string {
  return `Plumbline found ${amount(deferred, 'more problem')} than it opens issues for at once. They get their own issues over the next runs, so your repository is not flooded.`;
}

/** The comment when a person reopens an issue the app had left closed, or when the problems return. */
export function backComment(where: string): string {
  return `This problem is back as of ${where}, so this issue is open again.`;
}

/** The comment when the problem changed after a person closed the issue. */
export function changedComment(where: string): string {
  return `Plumbline found a different problem as of ${where}, so this issue is open again.`;
}

/** The comment on an issue of the old kind (one for a whole site), which is closed. */
export function replacedComment(): string {
  return 'Plumbline now keeps one issue for each check instead of one for the whole site, so this issue is closed. Each problem that is still there has its own issue.';
}
