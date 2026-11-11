/**
 * @packageDocumentation
 *
 * The run history of one of the signed-in person's domains as controllers over
 * the `core/api` framework: every run of its checks, whether the person
 * started it or the server did (a deployment, the daily re-check, a change to
 * `plumbline.yaml`). Read only.
 *
 *   GET /api/domains/{id}/runs           → 200, a page of runs, newest first
 *   GET /api/domains/{id}/runs/{run_id}  → 200, one run with every outcome
 */

import {
  ApiController,
  decodeCursor,
  ok,
  page,
  parseLimit,
  problems,
  type CursorPosition,
} from '@/lib/core/api';
import {
  liveUid,
  requestCookieResolver,
  type CurrentUserResolver,
} from '@/domain/api/auth';
import { isDomainId } from '@/domain/api/domain-resource';
import {
  isReportId,
  outcomeResources,
  type OutcomeResource,
} from '@/domain/api/report-resource';
import { getDatabase } from '@/domain/db/client';
import { getDomain, type Domain } from '@/domain/db/domains';
import {
  getRun,
  listRuns,
  suiteRunNumber,
  type Run,
  type RunSummary,
} from '@/domain/db/runs';

/** The signed-in caller's id and the domain the path names. */
interface DomainContext {
  readonly uid: number;
  readonly domainId: string;
}

/** The caller, the domain and the run the path names. */
interface RunContext extends DomainContext {
  readonly runId: string;
}

/** A run with every check's outcome, as the API sends it. */
export interface RunResource extends Omit<Run, 'outcomes'> {
  readonly outcomes: readonly OutcomeResource[];
}

/** Responses about one person's runs are theirs alone. */
const PRIVATE = { 'Cache-Control': 'private, no-cache' } as const;

/** One of the caller's domains, or a thrown 404. */
async function ownedDomain(uid: number, id: string): Promise<Domain> {
  const domain = isDomainId(id)
    ? await getDomain(getDatabase(), uid, id)
    : undefined;
  if (!domain) {
    throw problems.notFound('domain');
  }
  return domain;
}

/** Whether a path segment can be a run id: a report's UUID or a server run's `s` and number. */
export function isRunId(raw: string): boolean {
  return isReportId(raw) || suiteRunNumber(raw) !== undefined;
}

/**
 * A domain's runs: a page at a time, newest first, without their outcomes.
 * 404 when the person has no domain with that id, 400 for a cursor this API
 * did not hand out or a limit that is not a number in range.
 */
export function createRunsCollection(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<DomainContext> {
  return new ApiController<DomainContext>({
    context: async (request, route) => {
      const uid = await liveUid(request, resolver);
      const params = await route.params;
      return { uid, domainId: params?.['id'] ?? '' };
    },
  }).on<
    { readonly limit: number; readonly after?: CursorPosition },
    {
      readonly items: readonly RunSummary[];
      readonly next?: CursorPosition;
    }
  >({
    method: 'GET',
    decode: (request) => {
      const query = new URL(request.url).searchParams;
      const limit = parseLimit(query.get('limit'));
      if (limit instanceof Response) {
        throw limit;
      }
      const cursor = query.get('cursor');
      const after = cursor === null ? undefined : decodeCursor(cursor);
      if (cursor !== null && !after) {
        throw problems.badRequest('cursor: not one this API handed out.');
      }
      return after ? { limit, after } : { limit };
    },
    handle: async ({ limit, after }, { uid, domainId }) => {
      const domain = await ownedDomain(uid, domainId);
      // One more than a page, to know whether there is a next one.
      const found = await listRuns(
        getDatabase(),
        uid,
        { domainId: domain.id, host: domain.host },
        limit + 1,
        after ? { ran_at: after.key, id: after.id } : undefined,
      );
      const items = found.slice(0, limit);
      const last = items.at(-1);
      return found.length > limit && last
        ? { items, next: { key: last.ran_at, id: last.id } }
        : { items };
    },
    encode: ({ items, next }) => page(items, next, PRIVATE),
  });
}

/** The runs collection bound to the production resolver. */
export const runsCollection = createRunsCollection();

/**
 * One run, with every check's outcome. 404 when the person has no domain with
 * that id, or the domain has no such run (or the run kept no outcomes).
 */
export function createRunItem(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<RunContext> {
  return new ApiController<RunContext>({
    context: async (request, route) => {
      const params = await route.params;
      return {
        uid: await liveUid(request, resolver),
        domainId: params?.['id'] ?? '',
        runId: params?.['run-id'] ?? '',
      };
    },
  }).on<null, RunResource>({
    method: 'GET',
    handle: async (_input, { uid, domainId, runId }) => {
      const domain = await ownedDomain(uid, domainId);
      const run = isRunId(runId)
        ? await getRun(
            getDatabase(),
            uid,
            { domainId: domain.id, host: domain.host },
            runId,
          )
        : undefined;
      if (!run) {
        throw problems.notFound('run');
      }
      return { ...run, outcomes: outcomeResources(run.outcomes) };
    },
    encode: (run) => ok(run, { headers: PRIVATE }),
  });
}

/** The run item controller bound to the production resolver. */
export const runItem = createRunItem();
