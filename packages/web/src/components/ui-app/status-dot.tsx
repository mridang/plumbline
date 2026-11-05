import type { ReactElement } from 'react';

import { cn } from '@/components/ui/cn';

import { TONE_SOLID, type Tone } from './tone';

/** The sizes of a dot: beside a badge's text, beside a line, and the default. */
const SIZES = { xs: 'size-1.5', sm: 'size-2', md: 'size-2.5' } as const;

/** A small round marker in a tone's colour; `pulse` says something is going on. */
export function Dot({
  tone,
  pulse = false,
  size = 'md',
  className,
}: Readonly<{
  tone: Tone;
  pulse?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}>): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block shrink-0 rounded-full motion-safe:transition-colors',
        SIZES[size],
        TONE_SOLID[tone],
        pulse && 'motion-safe:animate-pulse',
        className,
      )}
    />
  );
}
