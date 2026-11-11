'use client';

import { useState, type ReactElement } from 'react';

import { CheckIcon, CopyIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';

/** How long "Copied" stays up, in milliseconds. */
export const COPIED_MS = 1500;

/**
 * A small button that copies `value` to the clipboard and says so for a moment.
 * It is quiet until the block it belongs to is hovered or focused (`group`).
 * Where the clipboard is not available it does nothing and says nothing.
 */
export function CopyButton({
  value,
  label,
  className,
}: Readonly<{
  value: string;
  /** What is copied, read out with the button. */
  label: string;
  className?: string;
}>): ReactElement {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? `${label}: copied` : `Copy ${label}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          return setTimeout(() => setCopied(false), COPIED_MS);
        });
      }}
      className={cn(
        'focus-ring-flush grid size-7 place-items-center rounded-control text-subtle hover:bg-ink/6 hover:text-ink motion-safe:transition',
        className,
      )}
    >
      {copied ? (
        <CheckIcon size="sm" className="text-passed" />
      ) : (
        <CopyIcon size="sm" />
      )}
    </button>
  );
}
