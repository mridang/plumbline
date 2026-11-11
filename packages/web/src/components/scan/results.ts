/**
 * @packageDocumentation
 *
 * Sorting a scan into what the page shows: the count of each outcome, and the
 * hints grouped by report section in the section's own order, with the worst
 * outcomes first inside each section.
 */

import type { IssueRef } from '@/domain/db/issue-history';
import type { HintOutcome } from '@/domain/scan/outcome';
import { compareText } from '@/lib/intl';

/** An outcome, as the engine names it. */
export type Status = HintOutcome['status'];

/** Which hints the list shows. */
export type Filter = 'problems' | Status | 'all';

/** The outcomes from worst to best; skipped last, since it says nothing about the site. */
export const STATUS_ORDER: readonly Status[] = [
  'failed',
  'warned',
  'passed',
  'skipped',
];

/** How many hints came to each outcome. */
export function countByStatus(
  hints: readonly HintOutcome[],
): Record<Status, number> {
  const counts: Record<Status, number> = {
    failed: 0,
    warned: 0,
    passed: 0,
    skipped: 0,
  };
  for (const hint of hints) {
    counts[hint.status] += 1;
  }
  return counts;
}

/** Whether a hint is shown under a filter. */
export function matches(hint: HintOutcome, filter: Filter): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'problems') {
    return hint.status === 'failed' || hint.status === 'warned';
  }
  return hint.status === filter;
}

/** One section of the list. */
export interface Section {
  readonly id: string;
  readonly title: string;
  readonly hints: readonly HintOutcome[];
}

/** The hints a filter shows, grouped by section; empty sections are left out. */
export function sectionsOf(
  hints: readonly HintOutcome[],
  filter: Filter,
): Section[] {
  const groups = new Map<
    string,
    { title: string; order: number; hints: HintOutcome[] }
  >();
  for (const hint of hints.filter((h) => matches(h, filter))) {
    const group = groups.get(hint.section) ?? {
      title: hint.sectionTitle,
      order: hint.sectionOrder,
      hints: [],
    };
    group.hints.push(hint);
    groups.set(hint.section, group);
  }
  return [...groups.entries()]
    .toSorted(
      ([, a], [, b]) => a.order - b.order || compareText(a.title, b.title),
    )
    .map(([id, group]) => ({
      id,
      title: group.title,
      hints: group.hints.toSorted(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
          compareText(a.name, b.name),
      ),
    }));
}

/** The words shown for each outcome. */
export const STATUS_LABELS: Readonly<Record<Status, string>> = {
  failed: 'Failed',
  warned: 'Warning',
  passed: 'Passed',
  skipped: 'Skipped',
};

/** Which checks a person has opened or closed by hand, by check id. */
export type OpenOverrides = Readonly<Record<string, boolean>>;

/**
 * Whether a check starts open: only one that failed. A warning, a pass and a
 * skip start closed, so a long list reads as a short one.
 */
export function openByDefault(hint: Readonly<HintOutcome>): boolean {
  return hint.status === 'failed';
}

/** Whether a check is open: as the person left it, else as it starts. */
export function isOpen(
  hint: Readonly<HintOutcome>,
  overrides: OpenOverrides,
): boolean {
  return overrides[hint.id] ?? openByDefault(hint);
}

/** Whether every one of these checks is open. */
export function allOpen(
  hints: readonly HintOutcome[],
  overrides: OpenOverrides,
): boolean {
  return hints.every((hint) => isOpen(hint, overrides));
}

/** What "Expand all" and "Collapse all" set: every one of these checks open or closed. */
export function setAll(
  hints: readonly HintOutcome[],
  open: boolean,
): OpenOverrides {
  return Object.fromEntries(hints.map((hint) => [hint.id, open]));
}

/** The issues of a site, grouped by the checks they reported, newest first. */
export function issuesByCheck(
  issues: readonly IssueRef[],
): Readonly<Record<string, readonly IssueRef[]>> {
  const grouped: Record<string, IssueRef[]> = {};
  for (const issue of issues) {
    for (const id of issue.checks) {
      const list = grouped[id] ?? [];
      list.push(issue);
      grouped[id] = list;
    }
  }
  return grouped;
}

/** What each state of an issue is called on the page. */
export const ISSUE_STATE_LABELS: Readonly<Record<IssueRef['state'], string>> = {
  open: 'Open',
  fixed: 'Closed — fixed',
  dismissed: 'Closed by a person',
};
