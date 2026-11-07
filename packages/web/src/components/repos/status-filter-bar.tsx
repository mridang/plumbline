'use client';

import type { ReactElement } from 'react';

import {
  CHIPS,
  toggleStatus,
  togglePaused,
  type Counts,
  type Filter,
} from '@/components/repos/site-filter';
import { RESULTS } from '@/components/repos/site-status';
import { FilterChip } from '@/components/ui-app/filter-chip';
import type { Tone } from '@/components/ui-app/tone';

/** The dot colour for each chip: the result's own, and red for a site that does not answer. */
function toneOf(status: (typeof CHIPS)[number]['status']): Tone {
  return status === 'unresponsive' ? 'bad' : RESULTS[status].tone;
}

/**
 * The filters of the list: "All", one chip for each result and for sites that do
 * not answer, then a toggle for the paused ones. The same chips are always
 * there, in the same order; a count of zero only goes muted. Pressing a chip
 * narrows the list to it and pressing it again (or "All") clears it.
 */
export function StatusFilterBar({
  counts,
  filter,
  onChange,
}: Readonly<{
  counts: Counts;
  filter: Filter;
  onChange: (filter: Filter) => void;
}>): ReactElement {
  return (
    <div
      role="group"
      aria-label="Filter sites by status"
      className="flex flex-wrap items-center gap-2"
    >
      <FilterChip
        label="All"
        count={counts.all}
        pressed={filter.status === null}
        onPress={() => onChange({ ...filter, status: null })}
      />
      {CHIPS.map((chip) => (
        <FilterChip
          key={chip.status}
          label={chip.label}
          count={counts[chip.status]}
          pressed={filter.status === chip.status}
          onPress={() => onChange(toggleStatus(filter, chip.status))}
          tone={toneOf(chip.status)}
          pulse={chip.status === 'running' && counts.running > 0}
        />
      ))}
      <span aria-hidden className="mx-1 hidden h-5 w-px bg-line sm:block" />
      <FilterChip
        label="Show paused"
        count={counts.paused}
        pressed={filter.paused}
        onPress={() => onChange(togglePaused(filter))}
      />
    </div>
  );
}
