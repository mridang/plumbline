/**
 * @packageDocumentation
 *
 * The live dashboard's tables: the log of what happened to a person's sites
 * (`live_events`, replayed to a browser that reconnects), and the overview of
 * every site read from `domains` alone, so it reads one table and no stored
 * runs.
 */

import { and, asc, eq, inArray, lt, or, sql } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { cutoffOf } from '@/domain/db/access';
import { domains, liveEvents, userRepositories } from '@/domain/db/schema';

/** How many events of one person are kept. */
export const KEEP_EVENTS = 200;

/** A check that began longer ago than this is taken to have died, in milliseconds. */
export const STALE_CHECK_MS = 5 * 60 * 1000;

/** Append an event to the person's log and return its position. */
export async function appendEvent(
  db: Database,
  userId: number,
  payload: unknown,
  at = new Date().toISOString(),
): Promise<number> {
  const [row] = await db
    .insert(liveEvents)
    .values({
      user_id: userId,
      payload: JSON.stringify(payload),
      created_at: at,
    })
    .returning({ id: liveEvents.id });
  const id = row?.id ?? 0;
  // Positions only grow, so everything older than the newest few is found by
  // its position: a range walk down the index, nothing counted or sorted.
  await db
    .delete(liveEvents)
    .where(
      and(eq(liveEvents.user_id, userId), lt(liveEvents.id, id - KEEP_EVENTS)),
    );
  return id;
}

/** Say that a check of the site began. */
export async function markChecking(
  db: Database,
  userId: number,
  host: string,
  at: string,
): Promise<void> {
  await db
    .update(domains)
    .set({ checking_since: at })
    .where(and(eq(domains.user_id, userId), eq(domains.host, host)));
}

/** What a check found, without the findings. */
export interface Counts {
  readonly errors: number;
  readonly warnings: number;
  readonly hints: number;
}

/** Say that a check ended: what it found, or that the site did not answer. */
export async function markChecked(
  db: Database,
  userId: number,
  host: string,
  result: Readonly<{ counts: Counts | null; at: string }>,
): Promise<void> {
  await db
    .update(domains)
    .set(
      result.counts
        ? { checking_since: null, reachable: 1, ...result.counts }
        : { checking_since: null, reachable: 0 },
    )
    .where(and(eq(domains.user_id, userId), eq(domains.host, host)));
}

/** How a site stands. */
export type SiteState =
  'running' | 'unchecked' | 'unreachable' | 'failing' | 'warning' | 'ok';

/** One site of the overview. */
export interface SiteStatus {
  readonly id: string;
  readonly host: string;
  readonly state: SiteState;
  readonly errors: number;
  readonly warnings: number;
  readonly hints: number;
  /** When the last check ended; null before the first. */
  readonly checked_at: string | null;
  /** Whether the person added it themselves: only then is its page theirs to open. */
  readonly mine: boolean;
}

/** The sites of one repository, or the ones added by hand when `repo` is null. */
export interface RepoStatus {
  readonly repo: string | null;
  readonly sites: readonly SiteStatus[];
}

/** How a site stands, from what is stored about it. */
export function stateOf(
  row: Readonly<{
    checking_since: string | null;
    errors: number | null;
    warnings: number | null;
    reachable: number;
  }>,
  now: number,
): SiteState {
  if (
    row.checking_since !== null &&
    now - Date.parse(row.checking_since) < STALE_CHECK_MS
  ) {
    return 'running';
  }
  if (row.errors === null) {
    return row.reachable === 0 ? 'unreachable' : 'unchecked';
  }
  if (row.reachable === 0) {
    return 'unreachable';
  }
  if (row.errors > 0) {
    return 'failing';
  }
  return (row.warnings ?? 0) > 0 ? 'warning' : 'ok';
}

/**
 * Every site the person can see grouped by repository, the ones added by hand
 * last: the ones they added, and every site of the repositories GitHub let
 * them see when they last signed in (see `access.ts`).
 */
export async function overviewOf(
  db: Database,
  userId: number,
  now = Date.now(),
): Promise<RepoStatus[]> {
  const rows = await db
    .select({
      id: domains.id,
      owner: domains.user_id,
      host: domains.host,
      repo: domains.repo,
      checked_at: domains.checked_at,
      checking_since: domains.checking_since,
      errors: domains.errors,
      warnings: domains.warnings,
      hints: domains.hints,
      reachable: domains.reachable,
    })
    .from(domains)
    .where(
      or(
        eq(domains.user_id, userId),
        inArray(
          domains.repo,
          db
            .select({ repo: userRepositories.repo })
            .from(userRepositories)
            .where(
              and(
                eq(userRepositories.user_id, userId),
                sql`${userRepositories.granted_at} > ${cutoffOf(now)}`,
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(domains.created_at), asc(domains.id));
  const byRepo = new Map<string | null, SiteStatus[]>();
  for (const row of rows) {
    const sites = byRepo.get(row.repo) ?? [];
    sites.push({
      id: row.id,
      host: row.host,
      state: stateOf(row, now),
      errors: row.errors ?? 0,
      warnings: row.warnings ?? 0,
      hints: row.hints ?? 0,
      checked_at: row.checked_at === '' ? null : row.checked_at,
      mine: row.owner === userId,
    });
    byRepo.set(row.repo, sites);
  }
  return [...byRepo]
    .map(([repo, sites]) => ({ repo, sites }))
    .toSorted((a, b) =>
      a.repo === null ? 1 : b.repo === null ? -1 : a.repo.localeCompare(b.repo),
    );
}
