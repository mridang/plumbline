/**
 * @packageDocumentation
 *
 * The repositories whose checks a person turned off. While a repository is in
 * the table its deployment and push webhooks are discarded, the schedule skips
 * its sites and its issue events are ignored. Turning checks off also closes
 * the repository's open issues (see `suite/disable.ts`); this module only keeps
 * the flag.
 */

import { and, eq, inArray, or, sql } from 'drizzle-orm';

import { cutoffOf } from '@/domain/db/access';
import type { Database } from '@/domain/db/client';
import {
  disabledRepos as disabledReposTable,
  domains,
  userRepositories,
} from '@/domain/db/schema';

/**
 * Whether the person has a site in `repo` on their dashboard: one they added,
 * or one of a repository GitHub let them see (see `access.ts`). Only such a
 * repository can be switched, so nobody can fill the table with names.
 */
export async function canSeeRepo(
  db: Database,
  userId: number,
  repo: string,
  now = Date.now(),
): Promise<boolean> {
  const [row] = await db
    .select({ id: domains.id })
    .from(domains)
    .where(
      and(
        eq(domains.repo, repo),
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
    .limit(1);
  return row !== undefined;
}

/** Whether checks are turned off for the repository. */
export async function isRepoDisabled(
  db: Database,
  repo: string,
): Promise<boolean> {
  const [row] = await db
    .select({ repo: disabledReposTable.repo })
    .from(disabledReposTable)
    .where(eq(disabledReposTable.repo, repo))
    .limit(1);
  return row !== undefined;
}

/**
 * Which of the repositories the person can see have their checks turned off.
 * Anyone with access sees the flag, since it belongs to the repository.
 */
export async function disabledRepos(
  db: Database,
  userId: number,
  now = Date.now(),
): Promise<Set<string>> {
  const rows = await db
    .select({ repo: disabledReposTable.repo })
    .from(disabledReposTable)
    .where(
      or(
        eq(disabledReposTable.user_id, userId),
        inArray(
          disabledReposTable.repo,
          db
            .select({ repo: domains.repo })
            .from(domains)
            .where(eq(domains.user_id, userId)),
        ),
        inArray(
          disabledReposTable.repo,
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
    );
  return new Set(rows.map((row) => row.repo));
}

/** Turn the repository's checks off; true when this changed anything (false when they already were). */
export async function disableRepo(
  db: Database,
  userId: number,
  repo: string,
  at = new Date().toISOString(),
): Promise<boolean> {
  const added = await db
    .insert(disabledReposTable)
    .values({ repo, user_id: userId, disabled_at: at })
    .onConflictDoNothing()
    .returning({ repo: disabledReposTable.repo });
  return added.length > 0;
}

/** Turn the repository's checks on again; false when they were not off. */
export async function enableRepo(db: Database, repo: string): Promise<boolean> {
  const removed = await db
    .delete(disabledReposTable)
    .where(eq(disabledReposTable.repo, repo))
    .returning({ repo: disabledReposTable.repo });
  return removed.length > 0;
}

/** Stop the repository's sites showing as checking: a check that was running will be discarded. */
export async function stopChecking(db: Database, repo: string): Promise<void> {
  await db
    .update(domains)
    .set({ checking_since: null })
    .where(eq(domains.repo, repo));
}
