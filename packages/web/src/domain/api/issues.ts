/**
 * @packageDocumentation
 *
 * The GitHub issues Plumbline opened for one of the signed-in person's domains
 * as a controller over the `core/api` framework. Read only.
 *
 *   GET /api/domains/{id}/issues → 200, the issues, newest first
 */

import { ApiController, page, problems } from '@/lib/core/api';
import {
  liveUid,
  requestCookieResolver,
  type CurrentUserResolver,
} from '@/domain/api/auth';
import { isDomainId } from '@/domain/api/domain-resource';
import { getDatabase } from '@/domain/db/client';
import { getDomain } from '@/domain/db/domains';
import { issuesOf, type IssueRef } from '@/domain/db/issue-history';

/** The signed-in caller's id and the domain the path names. */
interface DomainContext {
  readonly uid: number;
  readonly domainId: string;
}

/** Responses about one person's issues are theirs alone. */
const PRIVATE = { 'Cache-Control': 'private, no-cache' } as const;

/**
 * A domain's issues, newest first. 404 when the person has no domain with that
 * id; a domain no repository serves has none.
 */
export function createIssuesCollection(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<DomainContext> {
  return new ApiController<DomainContext>({
    context: async (request, route) => {
      const uid = await liveUid(request, resolver);
      const params = await route.params;
      return { uid, domainId: params?.['id'] ?? '' };
    },
  }).on<null, readonly IssueRef[]>({
    method: 'GET',
    handle: async (_input, { uid, domainId }) => {
      const db = getDatabase();
      const domain = isDomainId(domainId)
        ? await getDomain(db, uid, domainId)
        : undefined;
      if (!domain) {
        throw problems.notFound('domain');
      }
      return domain.repo ? issuesOf(db, domain.repo, domain.host) : [];
    },
    encode: (items) => page(items, undefined, PRIVATE),
  });
}

/** The issues collection bound to the production resolver. */
export const issuesCollection = createIssuesCollection();
