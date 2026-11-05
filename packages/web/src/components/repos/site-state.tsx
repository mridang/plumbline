import type { ReactElement } from 'react';

import { Dot } from '@/components/ui-app/status-dot';
import type { Tone } from '@/components/ui-app/tone';
import type { SiteState } from '@/domain/db/live';

/** The words and colours for each state of a site. */
export const STATES: Readonly<
  Record<SiteState, { label: string; tone: string; kind: Tone }>
> = {
  running: { label: 'Checking now', tone: 'text-accent', kind: 'info' },
  unchecked: { label: 'Not checked yet', tone: 'text-muted', kind: 'neutral' },
  unreachable: { label: 'Not answering', tone: 'text-failed', kind: 'bad' },
  failing: { label: 'Failing', tone: 'text-failed', kind: 'bad' },
  warning: { label: 'Warnings', tone: 'text-warned', kind: 'warn' },
  ok: { label: 'All clear', tone: 'text-passed', kind: 'good' },
};

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
  return <Dot tone={STATES[state].kind} pulse={state === 'running'} />;
}
