/**
 * @packageDocumentation
 *
 * The scans API. A scan runs in the visitor's browser; the Worker only starts
 * it and fetches for it.
 *
 *   POST /api/scans {url}                → 201 + Location {id, url, expires_at}
 *   POST /api/scans/{id}/fetches {url, method?, headers?}
 *                                        → 200, the target's body, with its
 *                                          status and headers in Upstream-*
 *
 * Starting a scan checks the address and signs an id for it (see
 * `domain/scan/token.ts`); nothing is stored. Each fetch must name a live scan
 * id, so the Worker only fetches for scans it started, and only until they end.
 */

import {
  readJsonObject,
  problem,
  problems,
  ApiController,
  created,
} from '@/lib/core/api';
import { getEnv } from '@/lib/core/runtime';
import type { RouteContext } from '@/lib/core/api/route-context';

import { readTarget } from '@/domain/scan/target';
import { issueScanId, readScanId, type ScanClaim } from '@/domain/scan/token';
import {
  forward,
  parseForwardRequest,
  UnreachableError,
  type ForwardRequest,
} from '@/domain/scan/forward';

/** The largest request body taken; an address and a few headers fit easily. */
const MAX_BODY_BYTES = 4096;

/** A scan, as the API shows it. */
export interface ScanResource {
  readonly id: string;
  readonly url: string;
  readonly expires_at: string;
}

/** Where the app's secrets come from; tests hand in their own. */
export type SecretSource = () => string | undefined;

const secretFromEnv: SecretSource = () => getEnv().SCAN_SECRET;

/** The answer when the app has no `SCAN_SECRET`: scans cannot be signed. */
function notConfigured(): Response {
  return problem(
    503,
    '/problems/not-configured',
    'Scans unavailable',
    'Scans are not set up on this server.',
  );
}

/** The secret, or a thrown 503 when there is none. */
function secretOf(source: SecretSource): string {
  const secret = source();
  if (!secret) {
    throw notConfigured();
  }
  return secret;
}

/** The scans collection: `POST /api/scans` starts one. */
export function createScansCollection(
  secret: SecretSource = secretFromEnv,
): ApiController {
  return new ApiController().on<URL, { id: string; claim: ScanClaim }>({
    method: 'POST',
    decode: async (request) => {
      const body = await readJsonObject(
        request,
        'The scan must be a JSON object.',
        [],
        MAX_BODY_BYTES,
      );
      if (!body.ok) {
        throw body.response;
      }
      const { url } = body.value;
      if (typeof url !== 'string') {
        throw problems.badRequest('Say which site to scan.', [
          'url: must be a string',
        ]);
      }
      const target = readTarget(url);
      if (!target.ok) {
        throw problems.badRequest(target.reason, [`url: ${target.reason}`]);
      }
      return target.url;
    },
    handle: (url) => issueScanId(url.href, secretOf(secret)),
    encode: ({ id, claim }) =>
      created<ScanResource>(
        { id, url: claim.url, expires_at: claim.expiresAt.toISOString() },
        `/api/scans/${id}`,
      ),
  });
}

export const scansCollection = createScansCollection();

/** A fetch's context: the scan it is for. */
interface FetchContext {
  readonly scan: ScanClaim;
}

/** The scan named in the path, or a thrown 404 when it is not a live one. */
async function scanOf(
  route: RouteContext,
  secret: SecretSource,
): Promise<ScanClaim> {
  const params = (await route.params) ?? {};
  const scan = await readScanId(params['id'] ?? '', secretOf(secret));
  if (!scan) {
    throw problems.notFound('scan, or it has ended');
  }
  return scan;
}

/** A scan's fetches: `POST /api/scans/{id}/fetches` makes one. */
export function createScanFetches(
  secret: SecretSource = secretFromEnv,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
): ApiController<FetchContext> {
  return new ApiController<FetchContext>({
    context: async (_request, route) => ({ scan: await scanOf(route, secret) }),
  }).on<ForwardRequest, Response>({
    method: 'POST',
    decode: async (request) => {
      const body = await readJsonObject(
        request,
        'The fetch must be a JSON object.',
        [],
        MAX_BODY_BYTES,
      );
      if (!body.ok) {
        throw body.response;
      }
      const parsed = parseForwardRequest(body.value);
      if (!parsed.ok) {
        throw problems.badRequest('The fetch is not valid.', parsed.errors);
      }
      return parsed.value;
    },
    handle: async (request) => {
      try {
        return await forward(request, fetcher);
      } catch (error) {
        if (error instanceof UnreachableError) {
          throw problem(
            502,
            '/problems/unreachable',
            'Site unreachable',
            error.message,
          );
        }
        throw error;
      }
    },
    encode: (response) => response,
  });
}

export const scanFetches = createScanFetches();
