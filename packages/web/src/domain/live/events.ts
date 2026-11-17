/**
 * @packageDocumentation
 *
 * What the live dashboard is told, and how it shows it. Pure and free of
 * server code, so the page in the browser and the tests use the same rules.
 */

import type { RepoStatus, SiteState, SiteStatus } from '@/domain/db/live';

/** A check of a site began. */
export interface StartedEvent {
  readonly type: 'started';
  readonly host: string;
  readonly repo: string | null;
  readonly at: string;
}

/** A check of a site ended: with counts, or `reachable: false` when it did not answer. */
export interface FinishedEvent {
  readonly type: 'finished';
  readonly host: string;
  readonly repo: string | null;
  readonly reachable: boolean;
  readonly errors?: number;
  readonly warnings?: number;
  readonly hints?: number;
  readonly at: string;
}

/** Everything the stream carries. */
export type LiveEvent = StartedEvent | FinishedEvent;

/** Whether a parsed frame is an event: of a known type, with the site and the time. */
function isLiveEvent(value: unknown): value is LiveEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const knownType =
    'type' in value && (value.type === 'started' || value.type === 'finished');
  const hasHost = 'host' in value && typeof value.host === 'string';
  const hasTime = 'at' in value && typeof value.at === 'string';
  return knownType && hasHost && hasTime;
}

/** The event in a frame's data, or null for anything that is not one. */
export function parseEvent(data: string): LiveEvent | null {
  try {
    const value: unknown = JSON.parse(data);
    return isLiveEvent(value) ? value : null;
  } catch {
    return null;
  }
}

/** The state a finished check leaves a site in. */
export function stateAfter(event: Readonly<FinishedEvent>): SiteState {
  if (!event.reachable) {
    return 'unreachable';
  }
  if ((event.errors ?? 0) > 0) {
    return 'failing';
  }
  return (event.warnings ?? 0) > 0 ? 'warning' : 'ok';
}

/** The overview after `event`: only the site it names changes. */
export function applyEvent(
  repos: readonly RepoStatus[],
  event: Readonly<LiveEvent>,
): RepoStatus[] {
  const update = (site: SiteStatus): SiteStatus =>
    event.type === 'started'
      ? { ...site, state: 'running' }
      : {
          ...site,
          state: stateAfter(event),
          errors: event.reachable ? (event.errors ?? 0) : site.errors,
          warnings: event.reachable ? (event.warnings ?? 0) : site.warnings,
          hints: event.reachable ? (event.hints ?? 0) : site.hints,
          checked_at: event.at,
        };
  return repos.map((repo) =>
    repo.repo === event.repo
      ? {
          ...repo,
          sites: repo.sites.map((site) =>
            site.host === event.host ? update(site) : site,
          ),
        }
      : repo,
  );
}

/** How many sites are in each state, for the summary line. */
export function tally(repos: readonly RepoStatus[]): Record<SiteState, number> {
  const states = repos.flatMap((repo) => repo.sites.map((site) => site.state));
  const inState = (state: SiteState): number =>
    states.filter((found) => found === state).length;
  return {
    running: inState('running'),
    unchecked: inState('unchecked'),
    unreachable: inState('unreachable'),
    failing: inState('failing'),
    warning: inState('warning'),
    ok: inState('ok'),
  };
}
