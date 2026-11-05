'use client';

import type { ReactElement } from 'react';

import { ShieldIcon } from '@/components/icons';
import { Popover } from '@/components/ui/popover';
import { CopyButton } from '@/components/ui-app/copy-button';

/**
 * The README badge, out of the way: a small "Badge" button in the page header
 * that opens a panel with the badge as it will look, its Markdown with a Copy
 * button, and one line on where it goes. Nothing about it is on the page until
 * it is asked for.
 */
export function BadgeMenu({
  repo,
  image,
  markdown,
}: Readonly<{
  repo: string;
  /** The address of the badge's picture. */
  image: string;
  /** The Markdown that shows it in a README. */
  markdown: string;
}>): ReactElement {
  return (
    <Popover
      button={
        <>
          <ShieldIcon size="sm" />
          Badge
        </>
      }
      buttonClassName="focus-ring inline-flex h-9 items-center gap-2 rounded-control border border-field bg-surface px-3 text-sm font-semibold hover:border-ink data-[state=open]:border-ink motion-safe:transition"
      panelClassName="w-[min(24rem,calc(100vw-2rem))] space-y-3 p-4"
    >
      <p className="text-sm font-semibold">README badge</p>
      <div className="flex min-h-12 items-center rounded-control border border-line bg-paper px-4">
        {/* The picture is ours, drawn at its own size: a plain image is right here. */}
        <img src={image} alt={`Plumbline badge for ${repo}`} height={20} />
      </div>
      <div className="flex items-center gap-1 rounded-control border border-field bg-surface py-1 pr-1 pl-3">
        <code
          aria-label={`Markdown for the badge of ${repo}`}
          className="min-w-0 flex-1 truncate font-mono text-xs"
        >
          {markdown}
        </code>
        <CopyButton value={markdown} label="the badge Markdown" />
      </div>
      <p className="text-xs text-pretty text-muted">
        Paste it into the README of {repo} to show how its sites stand.
      </p>
    </Popover>
  );
}
