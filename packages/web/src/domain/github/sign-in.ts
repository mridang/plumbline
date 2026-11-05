/**
 * @packageDocumentation
 *
 * Signing in with GitHub, for the people who use the dashboard but did not
 * install the app: an owner of an organization, or anyone with access to one of
 * its repositories. GitHub is asked who they are and which repositories of the
 * installed app they can reach; they get an ordinary session, and the
 * dashboard shows them only those repositories (see `db/access.ts`).
 *
 * A GitHub account that is already linked to a person (the one who connected
 * it from their Google account) signs in as that person; any other becomes a
 * person of its own, keyed by their GitHub id.
 */

import type { Database } from '@/domain/db/client';
import { replaceAccess } from '@/domain/db/access';
import { linkAccount, linkedUser } from '@/domain/db/github';
import { upsertUser, type User } from '@/domain/db/users';
import type { GitHubIdentity } from '@/domain/github/oauth';

/** The stable key a GitHub-only person is stored under, in place of a Google one. */
export function subjectOf(githubId: number): string {
  return `github:${githubId}`;
}

/**
 * The address GitHub gives every account for commits, used as the contact
 * address of a person who signed in with GitHub: the app never asks for their
 * real one.
 */
export function noreplyOf(
  identity: Pick<GitHubIdentity, 'id' | 'login'>,
): string {
  return `${identity.id}+${identity.login}@users.noreply.github.com`;
}

/**
 * The person for a GitHub identity: the one it is linked to, or a new one,
 * linked to it. The repositories they can reach replace the ones kept before.
 */
export async function signInWithGitHub(
  db: Database,
  identity: GitHubIdentity,
  repositories: readonly string[],
  at = new Date().toISOString(),
): Promise<User> {
  const linked = await linkedUser(db, identity.id);
  const user =
    linked ??
    (await upsertUser(db, {
      google_sub: subjectOf(identity.id),
      email: noreplyOf(identity),
      name: identity.name ?? identity.login,
      ...(identity.picture ? { picture: identity.picture } : {}),
    }));
  if (!linked) {
    await linkAccount(db, user.id, identity, at);
  }
  await replaceAccess(db, user.id, repositories, at);
  return user;
}
