/**
 * @packageDocumentation
 *
 * Repository for the GitHub tables: which GitHub account a person connected,
 * the installations of the app they own, and the repositories found in them.
 * Every read is scoped by the owner, so one person never sees another's.
 */

import { and, asc, eq, inArray, notInArray } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import {
  githubInstallations,
  githubLinks,
  githubRepos,
} from '@/domain/db/schema';

/** The GitHub account a person connected. */
export type GitHubLink = typeof githubLinks.$inferSelect;

/** An installation of the app. */
export type Installation = typeof githubInstallations.$inferSelect;

/** A repository of an installation, with its hosts read out of the JSON column. */
export interface StoredRepo {
  readonly installation_id: number;
  readonly full_name: string;
  readonly default_branch: string;
  /** The hosts the repository is deployed on; empty when it is not a web application. */
  readonly hosts: readonly string[];
  readonly analysed_at: string;
}

/** The hosts in a stored JSON array (anything unreadable counts as none). */
function hostsOf(text: string): readonly string[] {
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) && value.every((h) => typeof h === 'string')
      ? value
      : [];
  } catch {
    return [];
  }
}

/** The person's connected GitHub account, or undefined. */
export async function getLink(
  db: Database,
  userId: number,
): Promise<GitHubLink | undefined> {
  const [row] = await db
    .select()
    .from(githubLinks)
    .where(eq(githubLinks.user_id, userId))
    .limit(1);
  return row;
}

/**
 * Connect a GitHub account to a person. False, and nothing changes, when the
 * account is already connected to someone else.
 */
export async function linkAccount(
  db: Database,
  userId: number,
  account: Readonly<{ id: number; login: string }>,
  timestamp = new Date().toISOString(),
): Promise<boolean> {
  const [owner] = await db
    .select({ user_id: githubLinks.user_id })
    .from(githubLinks)
    .where(eq(githubLinks.github_id, account.id))
    .limit(1);
  if (owner && owner.user_id !== userId) {
    return false;
  }
  await db
    .insert(githubLinks)
    .values({
      user_id: userId,
      github_id: account.id,
      login: account.login,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .onConflictDoUpdate({
      target: githubLinks.user_id,
      set: {
        github_id: account.id,
        login: account.login,
        updated_at: timestamp,
      },
    });
  return true;
}

/** Disconnect the person's GitHub account, with its installations and repositories. */
export async function unlinkAccount(
  db: Database,
  userId: number,
): Promise<void> {
  await db.delete(githubRepos).where(eq(githubRepos.user_id, userId));
  await db
    .delete(githubInstallations)
    .where(eq(githubInstallations.user_id, userId));
  await db.delete(githubLinks).where(eq(githubLinks.user_id, userId));
}

/** The installations a person owns, oldest first. */
export async function listInstallations(
  db: Database,
  userId: number,
): Promise<Installation[]> {
  return db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.user_id, userId))
    .orderBy(asc(githubInstallations.created_at));
}

/** The owner of an installation, or undefined when none of our people has linked it. */
export async function ownerOfInstallation(
  db: Database,
  installationId: number,
): Promise<number | undefined> {
  const [row] = await db
    .select({ user_id: githubInstallations.user_id })
    .from(githubInstallations)
    .where(eq(githubInstallations.installation_id, installationId))
    .limit(1);
  return row?.user_id;
}

/** Record an installation as the person's. Not changed when another person already owns it. */
export async function saveInstallation(
  db: Database,
  userId: number,
  installationId: number,
  accountLogin: string,
  timestamp = new Date().toISOString(),
): Promise<boolean> {
  const owner = await ownerOfInstallation(db, installationId);
  if (owner !== undefined && owner !== userId) {
    return false;
  }
  await db
    .insert(githubInstallations)
    .values({
      installation_id: installationId,
      user_id: userId,
      account_login: accountLogin,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .onConflictDoUpdate({
      target: githubInstallations.installation_id,
      set: { account_login: accountLogin, updated_at: timestamp },
    });
  return true;
}

/** Forget an installation and the repositories found in it. */
export async function removeInstallation(
  db: Database,
  installationId: number,
): Promise<void> {
  await db
    .delete(githubRepos)
    .where(eq(githubRepos.installation_id, installationId));
  await db
    .delete(githubInstallations)
    .where(eq(githubInstallations.installation_id, installationId));
}

/** What the analysis of one repository found. */
export interface AnalysedRepo {
  readonly full_name: string;
  readonly default_branch: string;
  readonly hosts: readonly string[];
}

/**
 * Store what was found in an installation's repositories. Repositories no
 * longer in `repos` are forgotten, so removing one from the installation
 * removes it here.
 */
export async function saveRepos(
  db: Database,
  userId: number,
  installationId: number,
  repos: readonly AnalysedRepo[],
  timestamp = new Date().toISOString(),
): Promise<void> {
  const names = repos.map((repo) => repo.full_name);
  await db
    .delete(githubRepos)
    .where(
      names.length === 0
        ? eq(githubRepos.installation_id, installationId)
        : and(
            eq(githubRepos.installation_id, installationId),
            notInArray(githubRepos.full_name, names),
          ),
    );
  for (const repo of repos) {
    await db
      .insert(githubRepos)
      .values({
        installation_id: installationId,
        full_name: repo.full_name,
        user_id: userId,
        default_branch: repo.default_branch,
        hosts: JSON.stringify(repo.hosts),
        analysed_at: timestamp,
      })
      .onConflictDoUpdate({
        target: [githubRepos.installation_id, githubRepos.full_name],
        set: {
          user_id: userId,
          default_branch: repo.default_branch,
          hosts: JSON.stringify(repo.hosts),
          analysed_at: timestamp,
        },
      });
  }
}

/** The person's repositories, by name. */
export async function listRepos(
  db: Database,
  userId: number,
): Promise<StoredRepo[]> {
  const rows = await db
    .select()
    .from(githubRepos)
    .where(eq(githubRepos.user_id, userId))
    .orderBy(asc(githubRepos.full_name));
  return rows.map((row) => ({ ...row, hosts: hostsOf(row.hosts) }));
}

/** The repositories among `names` the person has, for the dashboard to match domains to them. */
export async function reposNamed(
  db: Database,
  userId: number,
  names: readonly string[],
): Promise<string[]> {
  if (names.length === 0) {
    return [];
  }
  const rows = await db
    .select({ full_name: githubRepos.full_name })
    .from(githubRepos)
    .where(
      and(
        eq(githubRepos.user_id, userId),
        inArray(githubRepos.full_name, [...names]),
      ),
    );
  return rows.map((row) => row.full_name);
}
