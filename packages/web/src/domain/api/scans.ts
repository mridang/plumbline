/**
 * @packageDocumentation
 *
 * The scans API. A scan runs every check on the server, in the scanner
 * container; the Worker starts it, and streams the checks back to the page.
 *
 *   POST /api/scans {url}                → 201 + Location {id, url, expires_at}
 *   POST /api/scans/{id}/run             → 200, a stream of the checks as the
 *                                          scanner container finishes them
 *
 * Starting a scan checks the address, puts it in its canonical form, makes
 * sure the page was not scanned in the last five minutes (see
 * `domain/scan/cooldown.ts`; 429 with `Retry-After` when it was) and signs an
 * id for it (see `domain/scan/token.ts`); nothing else is stored. A run must
 * name a live scan id, so the container only scans addresses the Worker
 * checked, and only until the id ends.
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
import {
  claimRun,
  claimScan,
  cooldownMessage,
  liveCooldownDeps,
  type CooldownDeps,
} from '@/domain/scan/cooldown';
import {
  runOnServer,
  ScannerError,
  type ScannerNamespace,
} from '@/domain/scan/run';
import { issueScanId, readScanId, type ScanClaim } from '@/domain/scan/token';

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
  cooldown: () => CooldownDeps = liveCooldownDeps,
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
    handle: async (url) => {
      const key = secretOf(secret);
      const decision = await claimScan(url.href, cooldown());
      if (!decision.allowed) {
        throw problems.rateLimited(
          cooldownMessage(url.href, decision.retryAfterSeconds),
          decision.retryAfterSeconds,
        );
      }
      return issueScanId(url.href, key);
    },
    encode: ({ id, claim }) =>
      created<ScanResource>(
        { id, url: claim.url, expires_at: claim.expiresAt.toISOString() },
        `/api/scans/${id}`,
      ),
  });
}

export const scansCollection = createScansCollection();

/** A scan route's context: the scan it is for. */
interface ScanContext {
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

/** A run's context: the scan, and the id it was named by (what its one run is counted against). */
interface RunContext extends ScanContext {
  readonly id: string;
}

/**
 * A scan's run: `POST /api/scans/{id}/run` has the scanner container run every
 * check on the scan's address and streams one line of JSON per check as it is
 * done. A ticket runs the checks once; 429 for a second run, 503 when there is
 * no scanner.
 */
export function createScanRun(
  secret: SecretSource = secretFromEnv,
  namespace: () => ScannerNamespace | undefined = () =>
    getEnv().SCANNER as unknown as ScannerNamespace | undefined,
  cooldown: () => CooldownDeps = liveCooldownDeps,
): ApiController<RunContext> {
  return new ApiController<RunContext>({
    context: async (_request, route) => ({
      scan: await scanOf(route, secret),
      id: ((await route.params) ?? {})['id'] ?? '',
    }),
  }).on<AbortSignal, Response>({
    method: 'POST',
    decode: async (request) => request.signal,
    handle: async (signal, context) => {
      const { scan, id } = context as RunContext;
      const target = namespace();
      if (!target) {
        throw notAvailable();
      }
      const decision = await claimRun(id, cooldown());
      if (!decision.allowed) {
        throw problems.rateLimited(
          'This scan has already run its checks. Start a new scan.',
          decision.retryAfterSeconds,
        );
      }
      try {
        return await runOnServer(target, scan.url, signal);
      } catch (error) {
        if (error instanceof ScannerError) {
          throw notAvailable();
        }
        throw error;
      }
    },
    encode: (response) => response,
  });
}

/** The answer when the scanner container is missing or did not answer. */
function notAvailable(): Response {
  return problem(
    503,
    '/problems/not-available',
    'Scans not available',
    'The scanner is not available. Try again in a moment.',
  );
}

export const scanRun = createScanRun();
