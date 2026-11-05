/**
 * @packageDocumentation
 *
 * Who can see which repository. A person signed in with GitHub is shown the
 * repositories of the installed app that GitHub says they can reach, and the
 * dashboard then shows every site of those repositories, not only the ones
 * they added themselves. GitHub is asked when they sign in, so what is kept is
 * a snapshot: it is honoured for {@link ACCESS_TTL_MS}, after which the person
 * has to sign in again, so losing access on GitHub takes effect within that
 * time.
 */

import { and, eq, gt, sql } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { userRepositories } from '@/domain/db/schema';

/** How long what GitHub said about a person's access is honoured, in milliseconds. */
export const ACCESS_TTL_MS = 12 * 60 * 60 * 1000;

/** The most repositories kept for one person. */
export const MAX_REPOSITORIES = 2000;

/**
 * The repositories as stored: once each, in the spelling GitHub gives them,
 * which is also how \`domains.repo\` is written, so the two compare as they are
 * and the index on \`domains.repo\` can be used.
 */
function normalise(repos: readonly string[]): string[] {
  return [...new Set(repos)].slice(0, MAX_REPOSITORIES);
}

/** The time before which access is no longer honoured. */
export function cutoffOf(now: number): string {
  return new Date(now - ACCESS_TTL_MS).toISOString();
}

/**
 * Replace the repositories a person can see with `repos`, as of `at`. One
 * batch: the old rows go and the new ones come in together, however many
 * there are (one statement reads them out of a JSON list).
 */
export async function replaceAccess(
  db: Database,
  userId: number,
  repos: readonly string[],
  at = new Date().toISOString(),
): Promise<void> {
  const names = normalise(repos);
  await db.batch([
    db.delete(userRepositories).where(eq(userRepositories.user_id, userId)),
    db
      .insert(userRepositories)
      .select(
        sql`select ${userId}, value, ${at} from json_each(${JSON.stringify(names)})`,
      ),
  ]);
}

/** The people who can see `repo`, by an index on the repository; at most `limit`. */
export async function peopleWithAccess(
  db: Database,
  repo: string,
  now = Date.now(),
  limit = 25,
): Promise<number[]> {
  const rows = await db
    .select({ user_id: userRepositories.user_id })
    .from(userRepositories)
    .where(
      and(
        eq(userRepositories.repo, repo),
        gt(userRepositories.granted_at, cutoffOf(now)),
      ),
    )
    .limit(limit);
  return rows.map((row) => row.user_id);
}
