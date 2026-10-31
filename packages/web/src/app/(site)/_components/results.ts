/**
 * @packageDocumentation
 *
 * Sorting a scan into what the page shows: the count of each outcome, and the
 * hints grouped by report section in the section's own order, with the worst
 * outcomes first inside each section.
 */

import type { HintOutcome } from '@/domain/scan/engine';

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
    .sort(([, a], [, b]) => a.order - b.order || a.title.localeCompare(b.title))
    .map(([id, group]) => ({
      id,
      title: group.title,
      hints: [...group.hints].sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
          a.name.localeCompare(b.name),
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
