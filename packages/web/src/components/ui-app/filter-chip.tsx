import type { ReactElement } from 'react';

import { cn } from '@/components/ui/cn';
import { Count } from '@/components/ui-app/count';
import { Dot } from '@/components/ui-app/status-dot';
import type { Tone } from '@/components/ui-app/tone';

/**
 * A button that turns one filter of a list on or off. `pressed` says it is on
 * (`aria-pressed`, and a filled look with a heavier edge, so it never relies on
 * colour alone); its count is muted at zero, and the chip stays so the row of
 * chips never changes.
 */
export function FilterChip({
  label,
  count,
  pressed,
  onPress,
  tone,
  pulse = false,
}: Readonly<{
  label: string;
  count: number;
  pressed: boolean;
  onPress: () => void;
  /** The colour of the dot before the label; none for a chip that is not about a state. */
  tone?: Tone;
  /** Make the dot pulse, for something going on. */
  pulse?: boolean;
}>): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onPress}
      className={cn(
        'focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap ring-1 ring-inset motion-safe:transition',
        pressed
          ? 'bg-ink text-surface ring-ink'
          : 'bg-surface text-ink ring-line hover:bg-ink/6',
      )}
    >
      {tone ? <Dot tone={tone} pulse={pulse} size="xs" /> : null}
      {label}
      <Count
        value={count}
        className={cn(
          'text-xs',
          pressed
            ? 'text-surface/80'
            : count === 0
              ? 'text-subtle'
              : 'text-muted',
        )}
      />
    </button>
  );
}
