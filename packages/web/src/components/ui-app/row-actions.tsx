'use client';

import type { ReactElement, ReactNode } from 'react';

import { Popover } from '@/components/ui/popover';

/** Three dots in a column, the usual mark for "more". */
function MoreMark(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

/**
 * The "more" button at the end of a row or the corner of a card: it opens the
 * things you can do with that row, as links and buttons (build them with the
 * popover's `POPOVER_ITEM` look). `label` names the row, so the button reads
 * "Actions for acme/site" and not just "Actions".
 */
export function RowActions({
  label,
  children,
}: Readonly<{
  label: string;
  children: ReactNode;
}>): ReactElement {
  return (
    <Popover
      label={`Actions for ${label}`}
      button={<MoreMark />}
      buttonClassName="focus-ring-flush grid size-8 place-items-center rounded-control text-subtle hover:bg-ink/6 hover:text-ink data-[state=open]:bg-ink/6 data-[state=open]:text-ink motion-safe:transition-colors"
      panelClassName="w-56"
    >
      {children}
    </Popover>
  );
}
