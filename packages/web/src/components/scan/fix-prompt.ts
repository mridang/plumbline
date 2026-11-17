/**
 * @packageDocumentation
 *
 * Turning a finished scan into one prompt a person can paste into a coding
 * assistant (Claude Code, Cursor, Copilot and the like) to have the problems
 * fixed in the project that serves the site. Only the checks that failed or
 * warned are written out, worst first inside each report section, with what
 * each one found and where. Nothing about the person or the scan beyond the
 * scanned address and the findings goes in.
 */

import { countOf } from '@/lib/intl';
import { placeOf } from './hint-row';
import { sectionsOf } from './results';
import type { Finding, HintOutcome } from '@/domain/scan/outcome';

/** The most findings written out for one check; the rest are counted. */
export const MAX_FINDINGS = 8;

/** The longest snippet written out, in characters. */
export const MAX_SNIPPET = 600;

/** What the prompt needs of a scan. */
export interface PromptScan {
  readonly finalUrl: string;
  readonly hints: readonly HintOutcome[];
}

/** Splits text into the characters a person sees. */
const GRAPHEMES = new Intl.Segmenter('en', { granularity: 'grapheme' });

/** The snippet of a finding, shortened and fenced in its language. */
function fenced(finding: Readonly<Finding>): string[] {
  if (!finding.snippet) {
    return [];
  }
  const characters = Array.from(
    GRAPHEMES.segment(finding.snippet),
    (part) => part.segment,
  );
  const shown =
    characters.length > MAX_SNIPPET
      ? `${characters.slice(0, MAX_SNIPPET).join('')}…`
      : finding.snippet;
  return [`  \`\`\`${finding.language ?? ''}`, ...indent(shown), '  ```'];
}

/** Indents each line by two spaces. */
function indent(text: string): string[] {
  return text.split('\n').map((line) => `  ${line}`);
}

/** One check, written out as a numbered block. */
function block(number: number, hint: Readonly<HintOutcome>): string[] {
  const more = hint.findings.length - MAX_FINDINGS;
  return [
    `### ${number}. ${hint.name} (${hint.status === 'failed' ? 'failed' : 'warning'})`,
    '',
    hint.description,
    '',
    'Found:',
    ...hint.findings
      .slice(0, MAX_FINDINGS)
      .flatMap((finding) => [
        `- ${finding.message} (${placeOf(finding)})`,
        ...fenced(finding),
      ]),
    ...(more > 0 ? [`- …and ${more} more of the same kind.`] : []),
    ...(hint.reference ? ['', `Reference: ${hint.reference}`] : []),
    '',
  ];
}

/** Whether a scan has anything for the prompt to ask for. */
export function hasProblems(hints: readonly HintOutcome[]): boolean {
  return hints.some(
    (hint) => hint.status === 'failed' || hint.status === 'warned',
  );
}

/**
 * The prompt for a scan: what to do, then every failed or warned check by
 * section, then the instruction to fix them. `repository` (`owner/name`) is
 * named when the project is known. Empty when nothing failed or warned.
 */
export function fixPrompt(
  scan: Readonly<PromptScan>,
  repository?: string,
): string {
  const problems = scan.hints.filter(
    (hint) => hint.status === 'failed' || hint.status === 'warned',
  );
  if (problems.length === 0) {
    return '';
  }
  const skipped = scan.hints.filter((hint) => hint.status === 'skipped').length;
  const project = repository
    ? `the project in this repository (${repository})`
    : 'this project';
  const sections = sectionsOf(scan.hints, 'problems');
  // Checks are numbered across sections: each section starts after the ones before it.
  const starts = sections.map((_, index) =>
    sections
      .slice(0, index)
      .reduce((sum, section) => sum + section.hints.length, 0),
  );
  return [
    `# Fix the problems Plumbline found on ${scan.finalUrl}`,
    '',
    `Plumbline scanned ${scan.finalUrl}, which is served by ${project}, and found ${countOf(problems.length, 'check')} needing attention. For each one below, find where the project produces the problem, make the smallest change that fixes it and leave unrelated code alone. Some fixes are headers, redirects or files served from the site root; make them wherever the project sets them (server or framework config, middleware, templates or the static assets).`,
    '',
    ...sections.flatMap((section, index) => [
      `## ${section.title}`,
      '',
      ...section.hints
        .toSorted(
          (a, b) =>
            Number(b.status === 'failed') - Number(a.status === 'failed'),
        )
        .flatMap((hint, position) =>
          block((starts[index] ?? 0) + position + 1, hint),
        ),
    ]),
    '## When you are done',
    '',
    'Fix every problem above that can be fixed in this repository. Then list what you changed, and name any problem you could not fix and why (for example one that needs a DNS record, a certificate or a hosting setting outside the repository). Do not mark a problem as fixed unless the change is in the code.',
    ...(skipped > 0
      ? [
          '',
          `${skipped} further checks (TLS, mail servers and the like) cannot run in a browser and are not covered here.`,
        ]
      : []),
    '',
    'Fix it.',
  ].join('\n');
}
