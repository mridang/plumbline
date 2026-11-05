/**
 * @packageDocumentation
 *
 * Hiding a repository from the dashboard, as a controller over the
 * `core/api` framework. Hiding changes what the person's dashboard lists and
 * nothing else; the route file only mounts it.
 */

import { ApiController, noContent, problems } from '@/lib/core/api';
import {
  liveUid,
  requestCookieResolver,
  type CurrentUserResolver,
} from '@/domain/api/auth';
import { getDatabase } from '@/domain/db/client';
import { canSeeRepo, hideRepo, unhideRepo } from '@/domain/db/hidden';

/** A GitHub owner: letters, digits and single hyphens. */
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

/** A GitHub repository name: letters, digits, dots, underscores and hyphens. */
const NAME = /^[A-Za-z0-9._-]{1,100}$/;

/** The person and the repository to act on. */
interface RepoContext {
  readonly uid: number;
  /** `owner/name`, or null when the path is not a repository name. */
  readonly repo: string | null;
}

/**
 * The repository the path names, or null when it cannot be one (a name that
 * does not match GitHub's, or `.` and `..`).
 */
export function repoOf(owner: string, name: string): string | null {
  return OWNER.test(owner) && NAME.test(name) && !/^\.+$/.test(name)
    ? `${owner}/${name}`
    : null;
}

/**
 * `PUT /api/users/self/repositories/hidden/{owner}/{repo}` hides the
 * repository from the signed-in person's dashboard (204, also when it already
 * is), and `DELETE` shows it again (204, 404 when it was not hidden). 404 for
 * a name that is not a repository or one the person cannot see, 401 without a
 * session, 403 cross-site. Checks, webhooks and GitHub issues carry on for a
 * hidden repository.
 */
export function createHiddenRepository(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<RepoContext> {
  return new ApiController<RepoContext>({
    context: async (request, route) => {
      const params = await route.params;
      return {
        uid: await liveUid(request, resolver),
        repo: repoOf(params?.['owner'] ?? '', params?.['repo'] ?? ''),
      };
    },
  })
    .on<null, void>({
      method: 'PUT',
      handle: async (_input, { uid, repo }) => {
        const db = getDatabase();
        if (repo === null || !(await canSeeRepo(db, uid, repo))) {
          throw problems.notFound('repository');
        }
        await hideRepo(db, uid, repo);
      },
      encode: () => noContent(),
    })
    .on<null, void>({
      method: 'DELETE',
      handle: async (_input, { uid, repo }) => {
        if (repo === null || !(await unhideRepo(getDatabase(), uid, repo))) {
          throw problems.notFound('repository');
        }
      },
      encode: () => noContent(),
    });
}

/** The hidden-repository controller bound to the production resolver. */
export const hiddenRepository = createHiddenRepository();
