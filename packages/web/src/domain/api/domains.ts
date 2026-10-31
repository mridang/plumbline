/**
 * @packageDocumentation
 *
 * The domains API as controllers over the `core/api` framework: the sites the
 * signed-in person keeps an eye on, and which checks run for each. The route
 * files only mount these. Each runs as the signed-in person (`liveUid`), and a
 * request from another site or with no live session is refused before any
 * handler runs. Each controller is a factory defaulting to the production
 * {@link requestCookieResolver}, so a test can inject a fake resolver.
 *
 *   GET    /api/domains              → 200, a page of domains
 *   POST   /api/domains {host}       → 201 + Location (200 + Location when the
 *                                       person already has it)
 *   GET    /api/domains/{id}         → 200 + ETag
 *   PATCH  /api/domains/{id} {checks} → 200 + ETag (If-Match honoured)
 *   DELETE /api/domains/{id}         → 204
 */

import {
  ApiController,
  created,
  decodeCursor,
  entityTag,
  ifMatchSatisfied,
  noContent,
  ok,
  page,
  parseLimit,
  problem,
  problems,
  readJsonObject,
  sliceAfter,
  type CursorPosition,
} from '@/lib/core/api';
import {
  liveUid,
  requestCookieResolver,
  type CurrentUserResolver,
} from '@/domain/api/auth';
import {
  domainResource,
  isDomainId,
  parseDomainInput,
  parseDomainPatch,
  type DomainResource,
} from '@/domain/api/domain-resource';
import { getDatabase } from '@/domain/db/client';
import {
  MAX_DOMAINS,
  addDomain,
  countDomains,
  deleteDomain,
  getDomain,
  listDomains,
  setDomainChecks,
  type Domain,
} from '@/domain/db/domains';
import { deleteReportsOf } from '@/domain/db/reports';

/** The signed-in caller's id. */
interface UidContext {
  readonly uid: number;
}

/** The signed-in caller's id and the domain the path names. */
interface DomainContext extends UidContext {
  readonly id: string;
}

/** Responses about one person's domains are theirs alone, and change. */
const PRIVATE = { 'Cache-Control': 'private, no-cache' } as const;

/** The path of a domain. */
export function domainPath(id: string): string {
  return `/api/domains/${id}`;
}

/** Where a domain sits in the list: when it was added, then its id. */
function positionOf(domain: Readonly<Domain>): CursorPosition {
  return { key: domain.created_at, id: domain.id };
}

/** Order two positions as the list is sorted (oldest first). */
function compare(a: CursorPosition, b: CursorPosition): number {
  return a.key === b.key
    ? a.id.localeCompare(b.id)
    : a.key.localeCompare(b.key);
}

/** The refusal for a person who already keeps the most domains allowed. */
function tooManyDomains(): Response {
  return problem(
    409,
    '/problems/too-many-domains',
    'Too many domains',
    `You can keep up to ${MAX_DOMAINS} domains. Remove one first.`,
  );
}

/** The entity tag of a domain's representation. */
export function domainTag(resource: DomainResource): Promise<string> {
  return entityTag(JSON.stringify(resource));
}

/**
 * The domains collection: `GET` lists the person's domains a page at a time,
 * oldest first; `POST` adds one (201), or answers 200 with the one they
 * already have for that host. 400 for a host that is not a public domain, 409
 * when they already keep {@link MAX_DOMAINS}, 401/403 when not signed in or
 * cross-site, 415 for a body that is not JSON.
 */
export function createDomainsCollection(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<UidContext> {
  return new ApiController<UidContext>({
    context: async (request) => ({ uid: await liveUid(request, resolver) }),
  })
    .on<
      { readonly limit: number; readonly after?: CursorPosition },
      { readonly items: readonly Domain[]; readonly next?: CursorPosition }
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
      handle: async ({ limit, after }, { uid }) =>
        sliceAfter(
          await listDomains(getDatabase(), uid),
          positionOf,
          compare,
          after,
          limit,
        ),
      encode: ({ items, next }) =>
        page(items.map(domainResource), next, PRIVATE),
    })
    .on<string, { readonly domain: Domain; readonly created: boolean }>({
      method: 'POST',
      decode: async (request) => {
        const body = await readJsonObject(
          request,
          'The domain must be a JSON object.',
        );
        if (!body.ok) {
          throw body.response;
        }
        const host = parseDomainInput(body.value);
        if (!host.ok) {
          throw problems.badRequest('The domain is not valid.', host.errors);
        }
        return host.value;
      },
      handle: async (host, { uid }) => {
        const db = getDatabase();
        if ((await countDomains(db, uid)) >= MAX_DOMAINS) {
          // Adding one they already have is still fine; it changes nothing.
          const existing = (await listDomains(db, uid)).find(
            (d) => d.host === host,
          );
          if (!existing) {
            throw tooManyDomains();
          }
          return { domain: existing, created: false };
        }
        return addDomain(db, uid, host);
      },
      encode: ({ domain, created: isNew }) =>
        isNew
          ? created(domainResource(domain), domainPath(domain.id))
          : ok(domainResource(domain), {
              location: domainPath(domain.id),
              headers: PRIVATE,
            }),
    });
}

/** The domains collection bound to the production resolver. */
export const domainsCollection = createDomainsCollection();

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

/** A domain's representation with its entity tag, as a 200. */
async function tagged(domain: Readonly<Domain>): Promise<Response> {
  const resource = domainResource(domain);
  return Response.json(resource, {
    headers: { ...PRIVATE, ETag: await domainTag(resource) },
  });
}

/**
 * One domain: `GET` reads it (with an `ETag`), `PATCH` chooses its checks
 * (JSON Merge Patch with `checks`: a list of check ids and group names, or
 * null for every check; `If-Match` is honoured, 412 when it no longer
 * matches), `DELETE` removes it and its reports. 404 when the person has no
 * domain with that id, 400 for checks that do not exist.
 */
export function createDomainItem(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<DomainContext> {
  return new ApiController<DomainContext>({
    context: async (request, route) => ({
      uid: await liveUid(request, resolver),
      id: (await route.params)?.['id'] ?? '',
    }),
  })
    .on<null, Response>({
      method: 'GET',
      handle: async (_input, { uid, id }) => tagged(await ownedDomain(uid, id)),
      encode: (response) => response,
    })
    .on<
      {
        readonly checks: readonly string[] | null;
        readonly ifMatch: string | null;
      },
      Response
    >({
      method: 'PATCH',
      decode: async (request) => {
        const body = await readJsonObject(
          request,
          'The patch must be a JSON object.',
          ['application/merge-patch+json'],
        );
        if (!body.ok) {
          throw body.response;
        }
        const checks = parseDomainPatch(body.value);
        if (!checks.ok) {
          throw problems.badRequest('The patch is not valid.', checks.errors);
        }
        return {
          checks: checks.value,
          ifMatch: request.headers.get('If-Match'),
        };
      },
      handle: async ({ checks, ifMatch }, { uid, id }) => {
        const current = await ownedDomain(uid, id);
        if (
          !ifMatchSatisfied(ifMatch, await domainTag(domainResource(current)))
        ) {
          throw problems.preconditionFailed();
        }
        const updated = await setDomainChecks(getDatabase(), uid, id, checks);
        if (!updated) {
          throw problems.notFound('domain');
        }
        return tagged(updated);
      },
      encode: (response) => response,
    })
    .on<null, void>({
      method: 'DELETE',
      handle: async (_input, { uid, id }) => {
        const db = getDatabase();
        if (!isDomainId(id) || !(await deleteDomain(db, uid, id))) {
          throw problems.notFound('domain');
        }
        await deleteReportsOf(db, uid, id);
      },
      encode: () => noContent(),
    });
}

/** The domain item controller bound to the production resolver. */
export const domainItem = createDomainItem();
