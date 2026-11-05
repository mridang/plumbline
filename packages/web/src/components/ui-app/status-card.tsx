import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

import { TONE_SOLID, type Tone } from './tone';

/**
 * A card with a coloured edge down its left side that says how what it holds
 * stands. `muted` dims it, for something set aside.
 */
export function StatusCard({
  tone,
  muted = false,
  className,
  children,
}: Readonly<{
  tone: Tone;
  muted?: boolean;
  className?: string;
  children: ReactNode;
}>): ReactElement {
  return (
    <article
      className={cn(
        'group/card relative flex flex-col overflow-hidden rounded-card border border-line bg-surface p-5 pl-6',
        'hover:border-ink/25 hover:shadow-[0_10px_28px_-18px_rgb(11_10_31/0.35)] motion-safe:transition motion-safe:duration-200',
        muted && 'opacity-70',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('absolute inset-y-0 left-0 w-1', TONE_SOLID[tone])}
      />
      {children}
    </article>
  );
}
