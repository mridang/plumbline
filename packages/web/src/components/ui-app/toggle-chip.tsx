'use client';

import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

/**
 * A pill-shaped button that is on or off, for choosing what a list shows. It
 * says which it is with `aria-pressed`, and a count may follow its label.
 */
export function ToggleChip({
  pressed,
  onClick,
  count,
  children,
}: Readonly<{
  pressed: boolean;
  onClick: () => void;
  count?: number;
  children: ReactNode;
}>): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'focus-ring h-9 rounded-full border px-4 text-sm font-medium motion-safe:transition',
        pressed
          ? 'border-ink bg-ink text-on-ink'
          : 'border-field bg-surface text-ink hover:border-ink',
      )}
    >
      {children}
      {count === undefined ? null : (
        <>
          {' '}
          <span className="tabular-nums opacity-70">{count}</span>
        </>
      )}
    </button>
  );
}
