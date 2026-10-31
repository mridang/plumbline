/**
 * @packageDocumentation
 *
 * Fetching from the browser through the Worker (see `forward.ts`). A browser
 * may not read another site's headers or body, so every request a scan makes
 * goes to `POST /api/scans/{id}/fetches`, and the target's status, headers and
 * body come back from there. The Worker does not follow redirects, so each hop
 * is one call, and the checks see every hop as they would in Node.
 */

import { problemMessage } from '@/components/api/problem-message';

/** A request a scan makes. */
export interface RelayRequest {
  readonly url: string;
  readonly method: 'GET' | 'HEAD';
  readonly headers: Readonly<Record<string, string>>;
}

/** What the target answered. */
export interface Relayed {
  readonly status: number;
  readonly url: string;
  /** Lower-case names, each `Set-Cookie` on its own. */
  readonly headers: readonly (readonly [string, string])[];
  readonly body: Uint8Array;
}

/** Makes one request through the Worker. */
export type Relay = (request: RelayRequest) => Promise<Relayed>;

/** The Worker answered with a problem instead of the target's response. */
export class RelayError extends Error {
  public readonly status: number;

  public constructor(status: number, detail: string) {
    super(detail);
    this.name = 'RelayError';
    this.status = status;
  }
}

/** The `Upstream-Headers` pairs, or none when they cannot be read. */
function pairsOf(value: string | null): [string, string][] {
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value ?? '[]'));
    return Array.isArray(parsed)
      ? parsed.filter(
          (pair): pair is [string, string] =>
            Array.isArray(pair) &&
            typeof pair[0] === 'string' &&
            typeof pair[1] === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

/** A relay for the scan `scanId`, posting with `transport` (the page's own `fetch`). */
export function relayFor(
  scanId: string,
  transport: typeof fetch = (input, init) => fetch(input, init),
): Relay {
  const endpoint = `/api/scans/${encodeURIComponent(scanId)}/fetches`;
  return async (request) => {
    const response = await transport(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new RelayError(response.status, await problemMessage(response));
    }
    return {
      status: Number(response.headers.get('upstream-status') ?? 0),
      url: response.headers.get('upstream-url') ?? request.url,
      headers: pairsOf(response.headers.get('upstream-headers')),
      body: new Uint8Array(await response.arrayBuffer()),
    };
  };
}

/** Statuses whose response may not carry a body. */
const NULL_BODY: ReadonlySet<number> = new Set([101, 204, 205, 304]);

/** Statuses that send the client elsewhere. */
const REDIRECTS: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

/** How many hops are followed when the caller asks to follow. */
const MAX_REDIRECTS = 10;

/** The request headers of a `fetch` call, as a plain object. */
function headersOf(init: RequestInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, name) => {
    out[name] = value;
  });
  return out;
}

/** A `Response` for what the target answered. (Browsers drop `Set-Cookie` here.) */
function responseOf(relayed: Relayed): Response {
  const headers = new Headers();
  for (const [name, value] of relayed.headers) {
    try {
      headers.append(name, value);
    } catch {
      // A header the platform will not hold; the checks that need it read the
      // relayed pairs instead.
    }
  }
  const response = new Response(
    NULL_BODY.has(relayed.status) ? null : new Uint8Array(relayed.body),
    { status: relayed.status, headers },
  );
  Object.defineProperty(response, 'url', { value: relayed.url });
  return response;
}

/**
 * A `fetch` that goes through `relay`, for checks that call `fetch` themselves.
 * Redirects are followed unless the call says `redirect: 'manual'`, in which
 * case the redirect itself is answered, as Node's `fetch` does (a browser's
 * would hide it). Addresses that are not http(s), such as `data:` URLs, go to
 * `local`.
 */
export function relayFetch(relay: Relay, local: typeof fetch): typeof fetch {
  return async (input, init) => {
    const first = new URL(input instanceof Request ? input.url : String(input));
    if (first.protocol !== 'http:' && first.protocol !== 'https:') {
      return local(input, init);
    }
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      throw new TypeError(`A scan can only GET or HEAD, not ${method}.`);
    }
    const headers = headersOf(init);
    let current = first;
    for (let hops = 0; ; hops += 1) {
      const relayed = await relay({
        url: current.href,
        method: method as 'GET' | 'HEAD',
        headers,
      });
      const location = relayed.headers.find(
        ([name]) => name === 'location',
      )?.[1];
      if (
        init?.redirect === 'manual' ||
        !REDIRECTS.has(relayed.status) ||
        !location ||
        hops >= MAX_REDIRECTS
      ) {
        return responseOf(relayed);
      }
      current = new URL(location, current);
    }
  };
}
