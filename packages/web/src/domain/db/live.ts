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
import {
  domains,
  liveEvents,
  suiteCheckIssues,
  suiteRuns,
  userRepositories,
} from '@/domain/db/schema';

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

/** A check broke before it could say anything about the site: it stops running and everything else stays as it was. */
export async function markCheckFailed(
  db: Database,
  userId: number,
  host: string,
): Promise<void> {
  await db
    .update(domains)
    .set({ checking_since: null })
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
  /** When the site was last deployed (a deployment run), null when none is known. */
  readonly deployed_at: string | null;
  /** The commit of that deployment, null when none is known. */
  readonly sha: string | null;
  /** Whether the person added it themselves: only then is its page theirs to open. */
  readonly mine: boolean;
}

/** The sites of one repository, or the ones added by hand when `repo` is null. */
export interface RepoStatus {
  readonly repo: string | null;
  readonly sites: readonly SiteStatus[];
  /** How many GitHub issues Plumbline has open for the repository's checks. */
  readonly open_issues: number;
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

/** How many values one query binds at most (D1 allows 100; one is kept for the owner). */
const BATCH = 80;

/** `items` in groups of at most {@link BATCH}. */
function inBatches<T>(items: readonly T[]): T[][] {
  const groups: T[][] = [];
  for (let at = 0; at < items.length; at += BATCH) {
    groups.push(items.slice(at, at + BATCH));
  }
  return groups;
}

/** The last deployment of a site: when, and which commit. */
interface Deployment {
  readonly at: string;
  readonly sha: string | null;
}

/**
 * The last deployment run of each site, keyed `owner/host`. One query for each
 * owner and group of hosts: the run is found by the newest id of the owner's
 * runs of the host (the `idx_suite_runs_host` index), and no run is read twice.
 */
async function deploymentsOf(
  db: Database,
  sites: readonly { owner: number; host: string }[],
): Promise<Map<string, Deployment>> {
  const hostsOf = new Map<number, Set<string>>();
  for (const site of sites) {
    const hosts = hostsOf.get(site.owner) ?? new Set<string>();
    hosts.add(site.host);
    hostsOf.set(site.owner, hosts);
  }
  const found = new Map<string, Deployment>();
  for (const [owner, hosts] of hostsOf) {
    for (const group of inBatches([...hosts])) {
      const rows = await db
        .select({
          host: suiteRuns.host,
          sha: suiteRuns.sha,
          ran_at: suiteRuns.ran_at,
        })
        .from(suiteRuns)
        .where(
          and(
            eq(suiteRuns.user_id, owner),
            inArray(suiteRuns.host, group),
            sql`
              ${suiteRuns.id} = (
                            select max(r.id) from suite_runs r
                            where r.user_id = ${suiteRuns.user_id}
                              and r.host = ${suiteRuns.host}
                              and r.kind = 'deployment')
            `,
          ),
        );
      for (const row of rows) {
        found.set(`${owner}/${row.host}`, { at: row.ran_at, sha: row.sha });
      }
    }
  }
  return found;
}

/** How many issues are open for each of the repositories, in one query for each group. */
async function openIssuesOf(
  db: Database,
  repos: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const group of inBatches(repos)) {
    const rows = await db
      .select({ repo: suiteCheckIssues.repo, total: sql<number>`count(*)` })
      .from(suiteCheckIssues)
      .where(
        and(
          inArray(suiteCheckIssues.repo, group),
          eq(suiteCheckIssues.state, 'open'),
        ),
      )
      .groupBy(suiteCheckIssues.repo);
    for (const row of rows) {
      counts.set(row.repo, Number(row.total));
    }
  }
  return counts;
}

/**
 * Every site the person can see grouped by repository, the ones added by hand
 * last: the ones they added, and every site of the repositories GitHub let
 * them see when they last signed in (see `access.ts`). With `only`, just that
 * repository (a page about one repository must not read every site of the
 * account to show one).
 */
export async function overviewOf(
  db: Database,
  userId: number,
  now = Date.now(),
  only?: string,
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
      and(
        only === undefined ? undefined : eq(domains.repo, only),
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
      ),
    )
    .orderBy(asc(domains.created_at), asc(domains.id));
  const [deployments, issues] = await Promise.all([
    deploymentsOf(
      db,
      rows.map((row) => ({ owner: row.owner, host: row.host })),
    ),
    openIssuesOf(db, [
      ...new Set(rows.flatMap((row) => (row.repo === null ? [] : [row.repo]))),
    ]),
  ]);
  const byRepo = new Map<string | null, SiteStatus[]>();
  for (const row of rows) {
    const deployed = deployments.get(`${row.owner}/${row.host}`);
    const sites = byRepo.get(row.repo) ?? [];
    sites.push({
      id: row.id,
      host: row.host,
      state: stateOf(row, now),
      errors: row.errors ?? 0,
      warnings: row.warnings ?? 0,
      hints: row.hints ?? 0,
      checked_at: row.checked_at === '' ? null : row.checked_at,
      deployed_at: deployed?.at ?? null,
      sha: deployed?.sha ?? null,
      mine: row.owner === userId,
    });
    byRepo.set(row.repo, sites);
  }
  return [...byRepo]
    .map(([repo, sites]) => ({
      repo,
      sites,
      open_issues: repo === null ? 0 : (issues.get(repo) ?? 0),
    }))
    .toSorted((a, b) =>
      a.repo === null ? 1 : (b.repo === null ? -1 : a.repo.localeCompare(b.repo)),
    );
}
