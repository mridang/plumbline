'use client';

import type { ReactElement, ReactNode } from 'react';

import { ChevronIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';

/** Which way a column is sorted, or null when the table is sorted by another. */
export type SortDirection = 'ascending' | 'descending' | null;

/**
 * A column heading that sorts the table when it is pressed. It says how the
 * column is sorted with `aria-sort`, and an arrow shows it. `align` follows the
 * column's cells, so the heading and the figures under it line up.
 */
export function SortHeadCell({
  direction,
  onSort,
  align = 'start',
  children,
}: Readonly<{
  direction: SortDirection;
  onSort: () => void;
  align?: 'start' | 'end';
  children: ReactNode;
}>): ReactElement {
  return (
    <th
      scope="col"
      aria-sort={direction ?? 'none'}
      className={cn(
        'px-4 py-2.5 font-medium whitespace-nowrap',
        align === 'end' ? 'text-right' : 'text-left',
      )}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          'focus-ring-flush -mx-1.5 inline-flex items-center gap-1 rounded-control px-1.5 py-0.5 hover:text-ink motion-safe:transition-colors',
          direction ? 'text-ink' : 'text-subtle',
        )}
      >
        {children}
        <ChevronIcon
          size="xs"
          className={cn(
            'motion-safe:transition',
            direction === null && 'opacity-0',
            direction === 'ascending' && 'rotate-180',
          )}
        />
      </button>
    </th>
  );
}
