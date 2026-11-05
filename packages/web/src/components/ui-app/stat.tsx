import type { ReactElement } from 'react';

import { cn } from '@/components/ui/cn';

import { Count } from './count';
import { TONE_TEXT, type Tone } from './tone';

/** A figure with its label above it, for a row of totals. */
export function Stat({
  label,
  value,
  tone = 'neutral',
}: Readonly<{
  label: string;
  value: number;
  tone?: Tone;
}>): ReactElement {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <dt className="text-label font-semibold text-subtle uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 text-3xl font-semibold',
          value === 0 ? 'text-subtle' : TONE_TEXT[tone],
        )}
      >
        <Count value={value} />
      </dd>
    </div>
  );
}

/**
 * A count in a table cell: coloured when there is something to see, muted when
 * it is zero, a dash when it was not kept. Its word is read out, not shown.
 */
export function CountCell({
  value,
  word,
  tone,
}: Readonly<{
  value: number | null;
  /** What it counts, for the tooltip and for people who hear the page. */
  word: string;
  tone: Tone;
}>): ReactElement {
  if (value === null) {
    return (
      <span className="text-subtle" title={`${word}: not kept for this run`}>
        –
      </span>
    );
  }
  return (
    <span
      className={cn(
        'tabular-nums',
        value === 0 ? 'text-subtle' : `font-semibold ${TONE_TEXT[tone]}`,
      )}
      title={`${value} ${word}`}
    >
      <Count value={value} />
      <span className="sr-only"> {word}</span>
    </span>
  );
}
