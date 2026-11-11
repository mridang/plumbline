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

/** The event in a frame's data, or null for anything that is not one. */
export function parseEvent(data: string): LiveEvent | null {
  try {
    const value: unknown = JSON.parse(data);
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const event = value as Partial<LiveEvent> & Record<string, unknown>;
    const isKnownType = event.type === 'started' || event.type === 'finished';
    return isKnownType &&
      typeof event.host === 'string' &&
      typeof event.at === 'string'
      ? (event as unknown as LiveEvent)
      : null;
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
  const counts: Record<SiteState, number> = {
    running: 0,
    unchecked: 0,
    unreachable: 0,
    failing: 0,
    warning: 0,
    ok: 0,
  };
  for (const repo of repos) {
    for (const site of repo.sites) {
      counts[site.state] += 1;
    }
  }
  return counts;
}
