import type { ReactElement } from 'react';

import { cn } from '@/components/ui/cn';

import { TONE_SOLID, type Tone } from './tone';

/** A small round marker in a tone's colour; `pulse` says something is going on. */
export function Dot({
  tone,
  pulse = false,
  className,
}: Readonly<{
  tone: Tone;
  pulse?: boolean;
  className?: string;
}>): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full motion-safe:transition-colors',
        TONE_SOLID[tone],
        pulse && 'motion-safe:animate-pulse',
        className,
      )}
    />
  );
}
