import type { ReactElement } from 'react';

import {
  availabilityOf,
  resultOf,
  type SiteResult,
} from '@/components/repos/site-filter';
import { Badge } from '@/components/ui-app/badge';
import type { Tone } from '@/components/ui-app/tone';
import type { SiteState } from '@/domain/db/live';

/** The words and tone for each result of a check. */
export const RESULTS: Readonly<
  Record<SiteResult, { label: string; tone: Tone }>
> = {
  running: { label: 'Checking', tone: 'info' },
  unchecked: { label: 'Unchecked', tone: 'neutral' },
  failing: { label: 'Failing', tone: 'bad' },
  warning: { label: 'Warnings', tone: 'warn' },
  ok: { label: 'Passing', tone: 'good' },
};

/** The result of the last check as a badge: the main status of a site. */
export function ResultBadge({
  result,
}: Readonly<{ result: SiteResult | null }>): ReactElement {
  if (result === null) {
    return <Badge>No result</Badge>;
  }
  const { label, tone } = RESULTS[result];
  return (
    <Badge tone={tone} dot pulse={result === 'running'}>
      {label}
    </Badge>
  );
}

/**
 * The state of a site when it is not simply live, as plain words beside the
 * result: "Paused" or "Unresponsive". A live site shows nothing. It is text and
 * not a badge, so it reads as a note on the result and never as one.
 */
export function SiteStateMarker({
  state,
  paused,
}: Readonly<{ state: SiteState; paused: boolean }>): ReactElement | null {
  const availability = availabilityOf(state, paused);
  if (availability === 'live') {
    return null;
  }
  return availability === 'paused' ? (
    <span className="text-xs text-muted">Paused</span>
  ) : (
    <span className="text-xs font-medium text-failed">Unresponsive</span>
  );
}

/** How a site stands: its result as the main badge and its state, when notable, beside it. */
export function SiteStanding({
  state,
  paused,
}: Readonly<{ state: SiteState; paused: boolean }>): ReactElement {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <ResultBadge result={resultOf(state)} />
      <SiteStateMarker state={state} paused={paused} />
    </span>
  );
}
