/**
 * @packageDocumentation
 *
 * One fetch made by the Worker on a scan's behalf. The checks run in the
 * visitor's browser, which may not read another site's headers or body (the
 * same-origin policy), so it asks the Worker to fetch for it, one request at a
 * time. Each call costs the Worker one outbound request and next to no CPU,
 * which keeps a whole scan inside the Workers Free plan's per-request limits.
 *
 * The answer is the target's body as it came, cut off at
 * {@link MAX_BODY_BYTES}, with the target's status, final address and headers
 * in `Upstream-*` headers (the headers as percent-encoded JSON pairs, so a
 * repeated `Set-Cookie` survives). Redirects are not followed: the browser
 * sees each hop, as the checks expect. Only public `http(s)` addresses are
 * fetched (and the Worker's `global_fetch_strictly_public` flag refuses
 * private ones whatever their name), only with `GET` or `HEAD`, and only with
 * the few request headers the checks send.
 */

import { isPublicWebUrl } from '@/lib/safe-fetch';

/** The user agent sent with every request, so site owners can tell what called. */
export const USER_AGENT =
  'Mozilla/5.0 (compatible; plumbline/1.0; +https://plumbline.apps.mrida.ng)';

/** How long the target may take to answer, in milliseconds. */
const TIMEOUT_MS = 10_000;

/** The most body passed on; the checks need far less. */
export const MAX_BODY_BYTES = 5 * 1024 * 1024;

/** The methods a check may use. */
export type ForwardMethod = 'GET' | 'HEAD';

/** The request headers a check may set; anything else is dropped. */
const ALLOWED_HEADERS: ReadonlySet<string> = new Set([
  'accept',
  'accept-language',
  'access-control-request-headers',
  'access-control-request-method',
  'if-modified-since',
  'if-none-match',
  'origin',
  'range',
]);

/** What a scan asks the Worker to fetch. */
export interface ForwardRequest {
  readonly url: string;
  readonly method: ForwardMethod;
  readonly headers: Readonly<Record<string, string>>;
}

/** Why a forward request was refused. */
export type ForwardRefusal = { readonly ok: false; readonly errors: string[] };

/**
 * A forward request from a JSON body, or the fields at fault: `url` must be a
 * public http(s) address, `method` GET or HEAD (GET when absent), and
 * `headers` an object of strings, of which only the allowed ones are kept.
 */
export function parseForwardRequest(
  body: Readonly<Record<string, unknown>>,
): { readonly ok: true; readonly value: ForwardRequest } | ForwardRefusal {
  const errors: string[] = Object.keys(body)
    .filter((name) => !['url', 'method', 'headers'].includes(name))
    .map((name) => `${name}: is not a field of a fetch`);
  const { url, method = 'GET', headers = {} } = body;
  if (typeof url !== 'string' || !isPublicWebUrl(url)) {
    errors.push('url: must be a public http or https address');
  }
  if (method !== 'GET' && method !== 'HEAD') {
    errors.push('method: must be GET or HEAD');
  }
  const kept: Record<string, string> = {};
  if (
    typeof headers !== 'object' ||
    headers === null ||
    Array.isArray(headers)
  ) {
    errors.push('headers: must be an object');
  } else {
    for (const [name, value] of Object.entries(headers)) {
      if (typeof value !== 'string') {
        errors.push(`headers.${name}: must be a string`);
      } else if (ALLOWED_HEADERS.has(name.toLowerCase())) {
        kept[name.toLowerCase()] = value;
      }
    }
  }
  return errors.length > 0
    ? { ok: false, errors }
    : {
        ok: true,
        value: {
          url: url as string,
          method: method as ForwardMethod,
          headers: kept,
        },
      };
}

/** The target's headers as name and value pairs, each `Set-Cookie` on its own. */
export function headerPairs(headers: Headers): [string, string][] {
  const pairs: [string, string][] = [];
  headers.forEach((value, name) => {
    if (name.toLowerCase() !== 'set-cookie') {
      pairs.push([name.toLowerCase(), value]);
    }
  });
  for (const cookie of headers.getSetCookie()) {
    pairs.push(['set-cookie', cookie]);
  }
  return pairs;
}

/** `body`, ending after {@link MAX_BODY_BYTES}. */
function capped(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  let left = MAX_BODY_BYTES;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        if (left <= 0) {
          controller.terminate();
          return;
        }
        controller.enqueue(
          chunk.byteLength > left ? chunk.subarray(0, left) : chunk,
        );
        left -= chunk.byteLength;
      },
    }),
  );
}

/** The target could not be reached: no answer, a refused address or a timeout. */
export class UnreachableError extends Error {
  public constructor(url: string, cause: unknown) {
    super(`${new URL(url).host} did not answer.`, { cause });
    this.name = 'UnreachableError';
  }
}

/**
 * Fetch `request` and answer with the target's body and, in `Upstream-*`
 * headers, its status, address and headers. Throws {@link UnreachableError}
 * when the target does not answer.
 */
export async function forward(
  request: ForwardRequest,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetcher(request.url, {
      method: request.method,
      headers: { ...request.headers, 'user-agent': USER_AGENT },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new UnreachableError(request.url, error);
  }
  const body =
    request.method === 'HEAD' || !upstream.body ? null : capped(upstream.body);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Upstream-Status': String(upstream.status),
      'Upstream-Url': request.url,
      'Upstream-Headers': encodeURIComponent(
        JSON.stringify(headerPairs(upstream.headers)),
      ),
    },
  });
}
