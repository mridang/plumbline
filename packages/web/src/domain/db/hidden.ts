/**
 * @packageDocumentation
 *
 * The repositories a person has hidden from their dashboard. Hiding changes
 * what the dashboard lists and nothing else: the checks, the webhooks and the
 * issues on GitHub carry on for a hidden repository.
 */

import { and, eq, inArray, or, sql } from 'drizzle-orm';

import { cutoffOf } from '@/domain/db/access';
import type { Database } from '@/domain/db/client';
import { domains, userHiddenRepos, userRepositories } from '@/domain/db/schema';

/** The repositories the person has hidden. */
export async function listHidden(
  db: Database,
  userId: number,
): Promise<Set<string>> {
  const rows = await db
    .select({ repo: userHiddenRepos.repo })
    .from(userHiddenRepos)
    .where(eq(userHiddenRepos.user_id, userId));
  return new Set(rows.map((row) => row.repo));
}

/**
 * Whether the person has a site in `repo` on their dashboard: one they added,
 * or one of a repository GitHub let them see (see `access.ts`). Only such a
 * repository can be hidden, so nobody can fill the table with names.
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

/** Hide the repository from the person's dashboard; hiding it again changes nothing. */
export async function hideRepo(
  db: Database,
  userId: number,
  repo: string,
  at = new Date().toISOString(),
): Promise<void> {
  await db
    .insert(userHiddenRepos)
    .values({ user_id: userId, repo, hidden_at: at })
    .onConflictDoNothing();
}

/** Show the repository on the dashboard again. False when it was not hidden. */
export async function unhideRepo(
  db: Database,
  userId: number,
  repo: string,
): Promise<boolean> {
  const removed = await db
    .delete(userHiddenRepos)
    .where(
      and(eq(userHiddenRepos.user_id, userId), eq(userHiddenRepos.repo, repo)),
    )
    .returning({ repo: userHiddenRepos.repo });
  return removed.length > 0;
}
