/**
 * @packageDocumentation
 *
 * The GitHub parts of the API, as controllers over the `core/api` framework.
 * Each runs as the signed-in person (`liveUid`); a request from another site
 * or with no live session is refused before any handler runs, and every error
 * is `application/problem+json`.
 *
 *   POST   /api/github/syncs     → 200, the installations read again
 *   DELETE /api/users/self/github → 204, the person's GitHub link forgotten
 */

import {
  liveUid,
  requestCookieResolver,
  type CurrentUserResolver,
} from '@/domain/api/auth';
import { getDatabase } from '@/domain/db/client';
import { getLink, unlinkAccount } from '@/domain/db/github';
import { githubConfig, syncAllOf } from '@/domain/github/service';
import {
  ApiController,
  noContent,
  ok,
  problem,
  problems,
} from '@/lib/core/api';

/** The signed-in caller's id. */
interface UidContext {
  readonly uid: number;
}

/** What reading the installations again found. */
interface SyncResource {
  readonly repositories: number;
  readonly deployed: number;
  readonly domains_added: number;
}

/**
 * `POST /api/github/syncs`: read the person's GitHub installations again, so
 * repositories added since, and changes to where they are deployed, show up.
 * 200 with what was found, 401 without a session, 403 cross-site, 503 when the
 * site has no GitHub settings.
 */
export function createGithubSyncs(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<UidContext> {
  return new ApiController<UidContext>({
    context: async (request) => ({ uid: await liveUid(request, resolver) }),
  }).on<null, SyncResource>({
    method: 'POST',
    handle: async (_input, { uid }) => {
      const config = githubConfig();
      if (!config) {
        throw problem(
          503,
          '/problems/not-configured',
          'GitHub is not set up',
          'GitHub is not set up on this site.',
        );
      }
      const result = await syncAllOf(getDatabase(), config, uid);
      return {
        repositories: result.repositories,
        deployed: result.deployed,
        domains_added: result.domainsAdded,
      };
    },
    encode: (body) => ok(body),
  });
}

/**
 * `DELETE /api/users/self/github`: forget the person's GitHub account, its
 * installations and the repositories found. Domains already added stay, and
 * the app stays installed on GitHub until they uninstall it there. 204, 404
 * when no account is connected, 401 without a session, 403 cross-site.
 */
export function createGithubLink(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<UidContext> {
  return new ApiController<UidContext>({
    context: async (request) => ({ uid: await liveUid(request, resolver) }),
  }).on<null, undefined>({
    method: 'DELETE',
    handle: async (_input, { uid }) => {
      const db = getDatabase();
      if (!(await getLink(db, uid))) {
        throw problems.notFound('GitHub account');
      }
      await unlinkAccount(db, uid);
      return undefined;
    },
    encode: () => noContent(),
  });
}

export const githubSyncs = createGithubSyncs();
export const githubLink = createGithubLink();
