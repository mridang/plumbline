/**
 * @packageDocumentation
 *
 * The checks API: every check plumbline can run, for anyone (nothing about it
 * is personal). The list is fixed for a deploy, so it may be cached.
 *
 *   GET /api/checks[?group=tls] → 200, a page of checks, sorted by id
 */

import {
  ApiController,
  decodeCursor,
  page,
  parseLimit,
  problems,
  sliceAfter,
  type CursorPosition,
} from '@/lib/core/api';
import {
  CHECKS,
  GROUPS,
  isGroup,
  checksInGroup,
  type Check,
} from '@/domain/checks/catalogue';

/** The list only changes with a deploy, and is the same for everyone. */
const CACHEABLE = { 'Cache-Control': 'public, max-age=300' } as const;

/** Where a check sits in the list: by id alone. */
function positionOf(check: Readonly<Check>): CursorPosition {
  return { key: check.id, id: check.id };
}

/** Order two positions as the list is sorted. */
function compare(a: CursorPosition, b: CursorPosition): number {
  return a.key.localeCompare(b.key);
}

/** What a request for the list asks for. */
interface ChecksQuery {
  readonly limit: number;
  readonly group?: string;
  readonly after?: CursorPosition;
}

/**
 * `GET /api/checks`: every check, a page at a time, optionally only the ones
 * in one `group` (a source such as `owasp`, or a topic such as `tls`). 400 for a
 * group that does not exist, a bad `limit` or a cursor this API did not issue.
 */
export function createChecksCollection(): ApiController {
  return new ApiController().on<
    ChecksQuery,
    { readonly items: readonly Check[]; readonly next?: CursorPosition }
  >({
    method: 'GET',
    decode: (request) => {
      const query = new URL(request.url).searchParams;
      const limit = parseLimit(query.get('limit'));
      if (limit instanceof Response) {
        throw limit;
      }
      const group = query.get('group');
      if (group !== null && !isGroup(group)) {
        throw problems.badRequest(
          `group: must be one of ${GROUPS.join(', ')}.`,
        );
      }
      const cursor = query.get('cursor');
      const after = cursor === null ? undefined : decodeCursor(cursor);
      if (cursor !== null && !after) {
        throw problems.badRequest('cursor: not one this API handed out.');
      }
      return {
        limit,
        ...(group !== null ? { group } : {}),
        ...(after ? { after } : {}),
      };
    },
    handle: ({ limit, group, after }) =>
      sliceAfter(
        group === undefined ? CHECKS : checksInGroup(group),
        positionOf,
        compare,
        after,
        limit,
      ),
    encode: ({ items, next }) => page(items, next, CACHEABLE),
  });
}

/** The checks collection. */
export const checksCollection = createChecksCollection();
