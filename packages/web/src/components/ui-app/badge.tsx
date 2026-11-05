import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

import { Dot } from './status-dot';
import { TONE_FILL, type Tone } from './tone';

/**
 * The one look for every label that says how something stands or what it is:
 * Failed, Warning, Passed, Skipped, Manual, a count, an issue's state. A fixed
 * height and one type size (text-xs, medium, tabular figures) keep the label on
 * the same baseline as the line it sits in, and `dot` adds the tone's colour as
 * a leading marker. It is text, never a control; a control that looks like one
 * is a button.
 */
const SIZES = {
  sm: 'h-5 gap-1 px-2',
  md: 'h-6 gap-1.5 px-2.5',
} as const;

export function Badge({
  tone = 'neutral',
  size = 'sm',
  dot = false,
  pulse = false,
  mono = false,
  title,
  className,
  children,
}: Readonly<{
  tone?: Tone;
  size?: keyof typeof SIZES;
  /** Lead with a small dot in the tone's colour. */
  dot?: boolean;
  /** Make the dot pulse, to say something is going on. */
  pulse?: boolean;
  /** Draw the text in the monospace face, for a commit or an id. */
  mono?: boolean;
  /** What a pointer shows when it rests on the badge. */
  title?: string;
  className?: string;
  children: ReactNode;
}>): ReactElement {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex w-fit shrink-0 items-center rounded-full text-xs leading-none font-medium whitespace-nowrap tabular-nums ring-1 ring-inset',
        SIZES[size],
        TONE_FILL[tone],
        mono && 'font-mono',
        className,
      )}
    >
      {dot ? <Dot tone={tone} pulse={pulse} size="xs" /> : null}
      {children}
    </span>
  );
}
