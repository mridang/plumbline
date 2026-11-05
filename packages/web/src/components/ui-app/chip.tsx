import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

import { TONE_FILL, type Tone } from './tone';

const SIZES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
} as const;

/**
 * A small rounded label: how a run started, the state of an issue, a count.
 * It is text, never a control; a control that looks like one is a button.
 */
export function Chip({
  tone = 'neutral',
  size = 'sm',
  mono = false,
  title,
  className,
  children,
}: Readonly<{
  tone?: Tone;
  size?: keyof typeof SIZES;
  /** Draw the text in the monospace face, for a commit or an id. */
  mono?: boolean;
  /** What a pointer shows when it rests on the chip. */
  title?: string;
  className?: string;
  children: ReactNode;
}>): ReactElement {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        SIZES[size],
        TONE_FILL[tone],
        mono && 'font-mono font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}
