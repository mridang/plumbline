import type { ReactElement } from 'react';

import type { SiteState } from '@/domain/db/live';

/** The words and colours for each state of a site. */
export const STATES: Readonly<
  Record<SiteState, { label: string; tone: string; dot: string }>
> = {
  running: { label: 'Checking now', tone: 'text-ink', dot: 'bg-ink' },
  unchecked: { label: 'Not checked yet', tone: 'text-muted', dot: 'bg-subtle' },
  unreachable: {
    label: 'Not answering',
    tone: 'text-failed',
    dot: 'bg-failed',
  },
  failing: { label: 'Failing', tone: 'text-failed', dot: 'bg-failed' },
  warning: { label: 'Warnings', tone: 'text-warned', dot: 'bg-warned' },
  ok: { label: 'All clear', tone: 'text-passed', dot: 'bg-passed' },
};

/** The states from the one to look at first to the one that needs nothing. */
const WORST_FIRST: readonly SiteState[] = [
  'unreachable',
  'failing',
  'warning',
  'running',
  'unchecked',
  'ok',
];

/** The state that needs the most attention among `states` (a repository's overall state). */
export function worstState(states: readonly SiteState[]): SiteState {
  return WORST_FIRST.find((state) => states.includes(state)) ?? 'unchecked';
}

/** A small round marker in the colour of a state; it pulses while a check runs. */
export function StatusDot({
  state,
}: Readonly<{ state: SiteState }>): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2.5 shrink-0 rounded-full ${STATES[state].dot} ${state === 'running' ? 'animate-pulse' : ''}`}
    />
  );
}
