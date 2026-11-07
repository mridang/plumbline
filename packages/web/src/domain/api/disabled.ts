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
import { getDatabase, type Database } from '@/domain/db/client';
import { NOT_INSTALLER } from '@/components/repos/checks-messages';
import { canManageRepo, canSeeRepo, enableRepo } from '@/domain/db/disabled';
import { pauseRepo, type PauseDeps } from '@/domain/suite/disable';

/** The person and the repository to act on. */
interface RepoContext {
  readonly uid: number;
  /** `owner/name`, or null when the path is not a repository name. */
  readonly repo: string | null;
}

/**
 * The repository the person may flip the switch of. 404 for a name that is not
 * a repository or one they cannot see (so its existence is not revealed), 403
 * for one they see but did not install the app for.
 */
async function mayManage(
  db: Database,
  uid: number,
  repo: string | null,
): Promise<string> {
  if (repo === null || !(await canSeeRepo(db, uid, repo))) {
    throw problems.notFound('repository');
  }
  if (!(await canManageRepo(db, uid, repo))) {
    throw problems.forbidden(NOT_INSTALLER);
  }
  return repo;
}

/**
 * `PUT /api/users/self/repositories/disabled/{owner}/{repo}` turns the
 * repository's checks off (204, also when they already are): its deployment
 * and push webhooks are discarded, the schedule skips it and its open issues
 * are closed with an explanation. `DELETE` turns them on again (204; 404 when
 * they were not off): checks resume with the next deployment or schedule. 404
 * for a name that is not a repository or one the person cannot see, 401
 * without a session, 403 cross-site and 403 for a repository the person can see
 * but did not install the app for: only the installer flips the switch.
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
        await pauseRepo(db, uid, await mayManage(db, uid, repo), deps);
      },
      encode: () => noContent(),
    })
    .on<null, void>({
      method: 'DELETE',
      handle: async (_input, { uid, repo }) => {
        const db = getDatabase();
        if (!(await enableRepo(db, await mayManage(db, uid, repo)))) {
          throw problems.notFound('repository');
        }
      },
      encode: () => noContent(),
    });
}

/** The controller bound to the production resolver. */
export const disabledRepository = createDisabledRepository();
