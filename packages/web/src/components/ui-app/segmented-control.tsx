'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';

import { cn } from '@/components/ui/cn';

/** One choice of a segmented control. */
export interface Segment {
  readonly value: string;
  readonly label: string;
  /** How many things the choice would show; drawn after the label. */
  readonly count?: number;
  /** Where the choice leads, for {@link SegmentedLinks}. */
  readonly href?: string;
}

/** The track the choices sit in. */
const TRACK =
  'inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-control bg-ink/6 p-0.5';

/** One choice: lifted off the track when it is the one in force. */
function segmentClass(on: boolean): string {
  return cn(
    'focus-ring-flush inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-3 text-sm font-medium whitespace-nowrap motion-safe:transition',
    on
      ? 'bg-surface text-ink shadow-xs ring-1 ring-line'
      : 'text-muted hover:text-ink',
  );
}

/** The figure after a choice's label. */
function Figure({
  count,
}: Readonly<{ count: number | undefined }>): ReactElement | null {
  return count === undefined ? null : (
    <span className="text-xs text-subtle tabular-nums">{count}</span>
  );
}

/**
 * A row of choices where exactly one is in force, for what a list shows. Each
 * choice is a button that says whether it is the one with `aria-pressed`; the
 * parent holds the choice and hears when it changes.
 */
export function SegmentedControl({
  label,
  options,
  value,
  onChange,
}: Readonly<{
  /** What the choices are for, read out with the group. */
  label: string;
  options: readonly Segment[];
  value: string;
  onChange: (value: string) => void;
}>): ReactElement {
  return (
    <div role="group" aria-label={label} className={TRACK}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={segmentClass(option.value === value)}
        >
          {option.label}
          <Figure count={option.count} />
        </button>
      ))}
    </div>
  );
}

/**
 * The same look for choices that are places: each is a link, and the one in
 * force is marked with `aria-current`. For a choice kept in the address, so
 * the page can be shared and the server draws the right one.
 */
export function SegmentedLinks({
  label,
  options,
  value,
}: Readonly<{
  label: string;
  options: readonly Segment[];
  value: string;
}>): ReactElement {
  return (
    <nav aria-label={label} className={TRACK}>
      {options.map((option) => (
        <Link
          key={option.value}
          href={option.href ?? '#'}
          aria-current={option.value === value ? 'true' : undefined}
          className={segmentClass(option.value === value)}
        >
          {option.label}
          <Figure count={option.count} />
        </Link>
      ))}
    </nav>
  );
}
