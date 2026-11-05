import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

/** Which side of a cell its content sits on. */
const ALIGN = { start: 'text-left', end: 'text-right' } as const;

/**
 * A table that scrolls inside its own box, never the page. The caption is read
 * out, not shown; `minWidth` is the width below which the box scrolls.
 */
export function Table({
  caption,
  minWidth = 'min-w-136',
  children,
}: Readonly<{
  caption: string;
  minWidth?: string;
  children: ReactNode;
}>): ReactElement {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className={cn('w-full text-left text-sm', minWidth)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

/** The header rows of a {@link Table}. */
export function TableHead({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <thead className="border-b border-line bg-ink/3 text-subtle">
      {children}
    </thead>
  );
}

/** The body rows of a {@link Table}. */
export function TableBody({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

/** A row; `current` tints the one the page is showing. */
export function Row({
  current = false,
  children,
}: Readonly<{ current?: boolean; children: ReactNode }>): ReactElement {
  return (
    <tr
      className={cn(
        'motion-safe:transition-colors',
        current ? 'bg-accent/6' : 'hover:bg-ink/3',
      )}
    >
      {children}
    </tr>
  );
}

/** A column heading. */
export function HeadCell({
  align = 'start',
  hidden = false,
  children,
}: Readonly<{
  align?: keyof typeof ALIGN;
  /** Read out but not shown, for a column whose cells explain themselves. */
  hidden?: boolean;
  children: ReactNode;
}>): ReactElement {
  return (
    <th
      scope="col"
      className={cn('px-4 py-2.5 font-medium whitespace-nowrap', ALIGN[align])}
    >
      {hidden ? <span className="sr-only">{children}</span> : children}
    </th>
  );
}

/** A cell. */
export function Cell({
  align = 'start',
  nowrap = true,
  children,
}: Readonly<{
  align?: keyof typeof ALIGN;
  nowrap?: boolean;
  children?: ReactNode;
}>): ReactElement {
  return (
    <td
      className={cn('px-4 py-2.5', ALIGN[align], nowrap && 'whitespace-nowrap')}
    >
      {children}
    </td>
  );
}
