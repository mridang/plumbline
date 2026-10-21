/**
 * HTTP to HTTPS redirection, a port of Mozilla Observatory's
 * `tests/redirection.js`: starting at the `http://` URL of the site, follow
 * the redirects and judge where they lead. The first hop must go to HTTPS on
 * the same host (so HSTS can be learned), and the final URL must be HTTPS.
 *
 * Observatory also counts a route as fine when every host on it is in the
 * HSTS preload list. The list is not bundled, so `isPreloaded` is a
 * dependency that defaults to "no host is preloaded".
 *
 * Requests go through `redirectionClient`, so tests replace it with a fake.
 */
import { finding, type Finding } from './finding.js';

export interface RedirectionClient {
  fetch(url: string, init: { redirect: 'manual' }): Promise<Response>;
}

/** The client the hint uses; tests replace `fetch`. */
export const redirectionClient: RedirectionClient = {
  fetch: (url, init) => globalThis.fetch(url, init),
};

export interface Hop {
  url: URL;
  status: number;
}

export type RedirectionResult =
  | 'redirection-all-redirects-preloaded'
  | 'redirection-to-https'
  | 'redirection-not-needed-no-http'
  | 'redirection-off-host-from-http'
  | 'redirection-not-to-https-on-initial-redirection'
  | 'redirection-not-to-https'
  | 'redirection-missing'
  | 'redirection-invalid-cert';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const CERT_ERRORS = new Set([
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

/** Whether a fetch failure was caused by an untrusted certificate. */
function isCertificateError(error: unknown): boolean {
  const code = error as { code?: string; cause?: { code?: string } } | null;
  return (
    CERT_ERRORS.has(code?.code ?? '') ||
    CERT_ERRORS.has(code?.cause?.code ?? '')
  );
}

export interface Route {
  hops: Hop[];
  /** The failure that ended the route early, if any. */
  invalidCert: boolean;
  /** True when even the first request could not be made. */
  unreachable: boolean;
}

/** Follows redirects by hand from `start`, up to `maxHops` requests. */
export async function followRedirects(
  start: URL,
  client: RedirectionClient = redirectionClient,
  maxHops = 10,
): Promise<Route> {
  const route: Route = { hops: [], invalidCert: false, unreachable: false };
  let current = start;
  for (let i = 0; i < maxHops; i++) {
    let response: Response;
    try {
      response = await client.fetch(current.href, { redirect: 'manual' });
    } catch (error) {
      if (route.hops.length === 0) {
        route.unreachable = true;
      } else if (isCertificateError(error)) {
        route.invalidCert = true;
      }
      return route;
    }
    route.hops.push({ url: current, status: response.status });
    const location = response.headers.get('location');
    if (!REDIRECT_STATUSES.has(response.status) || !location) {
      return route;
    }
    try {
      current = new URL(location, current);
    } catch {
      return route;
    }
  }
  return route;
}

/** Judges a route; `isPreloaded` says whether a host is HSTS preloaded. */
export function analyzeRedirection(
  route: Route,
  isPreloaded: (hostname: string) => boolean = () => false,
): RedirectionResult {
  if (route.unreachable) {
    return 'redirection-not-needed-no-http';
  }
  if (route.invalidCert) {
    return 'redirection-invalid-cert';
  }
  const hops = route.hops;
  if (hops.every((hop) => isPreloaded(hop.url.hostname))) {
    return 'redirection-all-redirects-preloaded';
  }
  if (hops.length === 1) {
    return 'redirection-missing';
  }
  const first = hops[0];
  const second = hops[1];
  if (hops.at(-1)?.url.protocol !== 'https:') {
    return 'redirection-not-to-https';
  }
  if (second?.url.protocol === 'http:') {
    return 'redirection-not-to-https-on-initial-redirection';
  }
  if (
    first?.url.protocol === 'http:' &&
    second?.url.protocol === 'https:' &&
    first.url.hostname !== second.url.hostname
  ) {
    return 'redirection-off-host-from-http';
  }
  return 'redirection-to-https';
}

const MESSAGES: Partial<Record<RedirectionResult, Finding>> = {
  'redirection-off-host-from-http': finding(
    'warning',
    "Initial redirection from HTTP to HTTPS is to a different host, preventing HSTS. HSTS headers aren't recognized when set over HTTP, so redirect to the same host on HTTPS first, then redirect to the final host.",
  ),
  'redirection-not-to-https-on-initial-redirection': finding(
    'error',
    'Redirects to HTTPS eventually, but initial redirection is to another HTTP URL. Redirect to the same host on HTTPS first, then redirect to the final host on HTTPS.',
  ),
  'redirection-not-to-https': finding(
    'error',
    'Redirects, but final destination is not an HTTPS URL. Redirect to the same host on HTTPS first, then redirect to the final host on HTTPS.',
  ),
  'redirection-missing': finding(
    'error',
    'Does not redirect to an HTTPS site. Redirect to the same host on HTTPS first, then redirect to the final host on HTTPS.',
  ),
  'redirection-invalid-cert': finding(
    'error',
    'Invalid certificate chain encountered during redirection. Install a valid TLS certificate on the server.',
  ),
};

/** Findings for a route; the passing results produce none. */
export function redirectionFindings(
  route: Route,
  isPreloaded?: (hostname: string) => boolean,
): Finding[] {
  const message = MESSAGES[analyzeRedirection(route, isPreloaded)];
  return message ? [message] : [];
}
