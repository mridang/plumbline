/**
 * @packageDocumentation
 *
 * Turning checks off and on for a repository, as a controller over the
 * `core/api` framework. The route file only mounts it.
 */

import { ApiController, noContent, problems } from '@/lib/core/api';
import {
  liveUid,
  requestCookieResolver,
  type CurrentUserResolver,
} from '@/domain/api/auth';
import { repoOf } from '@/domain/api/repo-name';
import { getDatabase } from '@/domain/db/client';
import { canSeeRepo, enableRepo } from '@/domain/db/disabled';
import { pauseRepo, type PauseDeps } from '@/domain/suite/disable';

/** The person and the repository to act on. */
interface RepoContext {
  readonly uid: number;
  /** `owner/name`, or null when the path is not a repository name. */
  readonly repo: string | null;
}

/**
 * `PUT /api/users/self/repositories/disabled/{owner}/{repo}` turns the
 * repository's checks off (204, also when they already are): its deployment
 * and push webhooks are discarded, the schedule skips it and its open issues
 * are closed with an explanation. `DELETE` turns them on again (204; 404 when
 * they were not off): checks resume with the next deployment or schedule. 404
 * for a name that is not a repository or one the person cannot see, 401
 * without a session, 403 cross-site.
 */
export function createDisabledRepository(
  resolver: CurrentUserResolver = requestCookieResolver,
  deps: PauseDeps = {},
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
        await pauseRepo(db, uid, repo, deps);
      },
      encode: () => noContent(),
    })
    .on<null, void>({
      method: 'DELETE',
      handle: async (_input, { uid, repo }) => {
        const db = getDatabase();
        if (
          repo === null ||
          !(await canSeeRepo(db, uid, repo)) ||
          !(await enableRepo(db, repo))
        ) {
          throw problems.notFound('repository');
        }
      },
      encode: () => noContent(),
    });
}

/** The controller bound to the production resolver. */
export const disabledRepository = createDisabledRepository();
