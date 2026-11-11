/**
 * @packageDocumentation
 *
 * The repositories whose checks a person turned off. While a repository is in
 * the table its deployment and push webhooks are discarded, the schedule skips
 * its sites and its issue events are ignored. Turning checks off also closes
 * the repository's open issues (see `suite/disable.ts`); this module only keeps
 * the flag. A repository's own `plumbline.yaml` can turn checks off too
 * (`enabled: false`); that is kept in its own table, since the file is its
 * source of truth, and a repository is off when either says so. Only the person
 * who installed the app for a repository may flip the switch.
 */

import { and, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

import { cutoffOf } from '@/domain/db/access';
import type { Database } from '@/domain/db/client';
import { installationOfRepo, ownerOfInstallation } from '@/domain/db/github';
import {
  configDisabledRepos,
  disabledRepos as disabledReposTable,
  domains,
  githubInstallations,
  githubRepos,
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

/** Whether a person turned the repository's checks off with the switch. */
export async function isRepoSwitchedOff(
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

/** Whether the repository's own `plumbline.yaml` turns its checks off. */
export async function isRepoFileDisabled(
  db: Database,
  repo: string,
): Promise<boolean> {
  const [row] = await db
    .select({ repo: configDisabledRepos.repo })
    .from(configDisabledRepos)
    .where(eq(configDisabledRepos.repo, repo))
    .limit(1);
  return row !== undefined;
}

/** Whether checks are turned off for the repository, by the switch or by its file: either one is enough. */
export async function isRepoDisabled(
  db: Database,
  repo: string,
): Promise<boolean> {
  return (
    (await isRepoSwitchedOff(db, repo)) || (await isRepoFileDisabled(db, repo))
  );
}

/**
 * Whether the person may flip the repository's switch: they own the GitHub App
 * installation that covers it. Two reads by key (the repository's name, then
 * the installation).
 */
export async function canManageRepo(
  db: Database,
  userId: number,
  repo: string,
): Promise<boolean> {
  const installation = await installationOfRepo(db, repo);
  return (
    installation !== undefined &&
    (await ownerOfInstallation(db, installation)) === userId
  );
}

/** The repositories among the person's own installations: those whose switch they may flip. */
export async function manageableRepos(
  db: Database,
  userId: number,
): Promise<Set<string>> {
  const rows = await db
    .select({ repo: githubRepos.full_name })
    .from(githubRepos)
    .innerJoin(
      githubInstallations,
      eq(githubInstallations.installation_id, githubRepos.installation_id),
    )
    .where(eq(githubInstallations.user_id, userId));
  return new Set(rows.map((row) => row.repo));
}

/** The condition that a repository column names a repository the person has a site in, or one GitHub let them see. */
function visibleTo(
  db: Database,
  column: SQLiteColumn,
  userId: number,
  now: number,
): SQL {
  return or(
    inArray(
      column,
      db
        .select({ repo: domains.repo })
        .from(domains)
        .where(eq(domains.user_id, userId)),
    ),
    inArray(
      column,
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
  ) as SQL;
}

/**
 * Which of the repositories the person can see have their checks turned off,
 * by the switch or by their file. Anyone with access sees the flag, since it
 * belongs to the repository.
 */
export async function disabledRepos(
  db: Database,
  userId: number,
  now = Date.now(),
): Promise<Set<string>> {
  const [switched, byFile] = await Promise.all([
    db
      .select({ repo: disabledReposTable.repo })
      .from(disabledReposTable)
      .where(
        or(
          eq(disabledReposTable.user_id, userId),
          visibleTo(db, disabledReposTable.repo, userId, now),
        ),
      ),
    fileDisabledRepos(db, userId, now),
  ]);
  return new Set(switched.map((row) => row.repo)).union(byFile);
}

/** Which of the repositories the person can see have their checks turned off by their own `plumbline.yaml`. */
export async function fileDisabledRepos(
  db: Database,
  userId: number,
  now = Date.now(),
): Promise<Set<string>> {
  const rows = await db
    .select({ repo: configDisabledRepos.repo })
    .from(configDisabledRepos)
    .where(visibleTo(db, configDisabledRepos.repo, userId, now));
  return new Set(rows.map((row) => row.repo));
}

/** Note that the repository's file turns checks off; true when this is new (false when it was already noted). */
export async function disableRepoByFile(
  db: Database,
  repo: string,
  at = new Date().toISOString(),
): Promise<boolean> {
  const added = await db
    .insert(configDisabledRepos)
    .values({ repo, disabled_at: at })
    .onConflictDoNothing()
    .returning({ repo: configDisabledRepos.repo });
  return added.length > 0;
}

/** Note that the repository's file no longer turns checks off; false when it had not been noted. */
export async function enableRepoByFile(
  db: Database,
  repo: string,
): Promise<boolean> {
  const removed = await db
    .delete(configDisabledRepos)
    .where(eq(configDisabledRepos.repo, repo))
    .returning({ repo: configDisabledRepos.repo });
  return removed.length > 0;
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
