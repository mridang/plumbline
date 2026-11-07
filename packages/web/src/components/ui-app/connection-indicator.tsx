import type { ReactElement } from 'react';

import { Dot } from '@/components/ui-app/status-dot';
import type { Tone } from '@/components/ui-app/tone';

/** How the page's link to the server stands. */
export type Connection = 'connecting' | 'live' | 'offline';

const WORDS: Readonly<Record<Connection, { label: string; tone: Tone }>> = {
  connecting: { label: 'Connecting…', tone: 'neutral' },
  live: { label: 'Updating live', tone: 'good' },
  offline: { label: 'Offline, not updating', tone: 'warn' },
};

/**
 * A small dot and a few words for whether the page is receiving updates. It is
 * about the connection, not about any site, and is plain text, never a button
 * or a chip, so it cannot be mistaken for a filter.
 */
export function ConnectionIndicator({
  state,
}: Readonly<{ state: Connection }>): ReactElement {
  const { label, tone } = WORDS[state];
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 text-xs text-muted"
    >
      <Dot tone={tone} pulse={state === 'connecting'} size="xs" />
      {label}
    </span>
  );
}
