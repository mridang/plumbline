/**
 * @packageDocumentation
 *
 * The scans API. A scan runs in the visitor's browser; the Worker only starts
 * it and fetches for it.
 *
 *   POST /api/scans {url}                → 201 + Location {id, url, expires_at}
 *   POST /api/scans/{id}/run             → 200, a stream of the checks as the
 *                                          scanner container finishes them
 *   POST /api/scans/{id}/fetches {url, method?, headers?}
 *                                        → 200, the target's body, with its
 *                                          status and headers in Upstream-*
 *
 * Starting a scan checks the address, puts it in its canonical form, makes
 * sure the page was not scanned in the last five minutes (see
 * `domain/scan/cooldown.ts`; 429 with `Retry-After` when it was) and signs an
 * id for it (see `domain/scan/token.ts`); nothing else is stored. Each fetch must name a live scan
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
import {
  claimRun,
  claimScan,
  cooldownMessage,
  liveCooldownDeps,
  type CooldownDeps,
} from '@/domain/scan/cooldown';
import {
  parseProbeRequest,
  ProbeError,
  runProbe,
  type ProbeNamespace,
  type ProbeRequest,
} from '@/domain/scan/probe';
import {
  runOnServer,
  ScannerError,
  type ScannerNamespace,
} from '@/domain/scan/run';
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

/** A scan's probes: `POST /api/scans/{id}/probes` makes one TLS handshake in the prober container. */
export function createScanProbes(
  secret: SecretSource = secretFromEnv,
  namespace: () => ProbeNamespace | undefined = () =>
    getEnv().PROBE as unknown as ProbeNamespace | undefined,
): ApiController<FetchContext> {
  return new ApiController<FetchContext>({
    context: async (_request, route) => ({ scan: await scanOf(route, secret) }),
  }).on<ProbeRequest, Response>({
    method: 'POST',
    decode: async (request, context) => {
      const body = await readJsonObject(
        request,
        'The probe must be a JSON object.',
        [],
        MAX_BODY_BYTES,
      );
      if (!body.ok) {
        throw body.response;
      }
      const parsed = parseProbeRequest(
        body.value,
        new URL((context as FetchContext).scan.url).hostname,
      );
      if (!parsed.ok) {
        throw problems.badRequest('The probe is not valid.', parsed.errors);
      }
      return parsed.value;
    },
    handle: async (request) => {
      try {
        return await runProbe(namespace(), request);
      } catch (error) {
        if (error instanceof ProbeError) {
          throw problem(
            error.status,
            error.status === 502
              ? '/problems/handshake-failed'
              : '/problems/not-available',
            error.status === 502 ? 'Handshake failed' : 'Probes not available',
            error.message,
          );
        }
        throw error;
      }
    },
    encode: (response) => response,
  });
}

export const scanProbes = createScanProbes();

/** A run's context: the scan, and the id it was named by (what its one run is counted against). */
interface RunContext extends FetchContext {
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
