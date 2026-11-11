/**
 * @packageDocumentation
 *
 * A `fetch` that makes its requests through the probe. The probe speaks HTTP/1.1
 * on its own sockets, so the headers a check reads are the ones the site sent a
 * visitor (a Worker's own `fetch` drops `Alt-Svc` and decodes `Content-Encoding`
 * away), and the response is built the way the Node guard builds it: one header
 * entry for each header line, the body decoded and capped, redirects followed by
 * hand so each hop can be checked.
 */

import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';

import { ProbeError } from './protocol.js';
import type { HttpRequest, ProbeClient } from './client.js';
import { ScanRefused, assertScannable } from '../scannable.js';

/** The user agent sent with every request, so site owners can tell what called. */
export const USER_AGENT =
  'Mozilla/5.0 (compatible; plumbline/1.0; +https://plumbline.apps.mrida.ng)';

/** The most body bytes read (after decompression). */
const MAX_BYTES = 10 * 1024 * 1024;

/** The status codes that redirect. */
const REDIRECTS: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

/** Whether a status carries no body. */
function bodyless(status: number): boolean {
  return [101, 204, 205, 304].includes(status);
}

/** The body with its chunks put together (`Transfer-Encoding: chunked`). */
export function unchunk(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  let at = 0;
  let total = 0;
  let more = true;
  while (more) {
    let end = at;
    while (
      end + 1 < bytes.length &&
      !(bytes[end] === 13 && bytes[end + 1] === 10)
    ) {
      end += 1;
    }
    if (end + 1 >= bytes.length) {
      throw new ProbeError('the response ended inside a chunk header');
    }
    const size = Number.parseInt(
      new TextDecoder()
        .decode(bytes.subarray(at, end))
        .split(';', 1)[0]
        ?.trim() ?? '',
      16,
    );
    if (!Number.isFinite(size) || size < 0) {
      throw new ProbeError(
        'the response has a chunk size that is not a number',
      );
    }
    at = end + 2;
    if (size === 0) {
      more = false;
    } else if (at + size > bytes.length) {
      // The probe cut the body at its limit; keep what came.
      parts.push(bytes.subarray(at));
      total += bytes.length - at;
      more = false;
    } else {
      parts.push(bytes.subarray(at, at + size));
      total += size;
      at += size + 2;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** The body with its content coding undone. A coding this does not know is left alone. */
export function decode(
  bytes: Uint8Array,
  encoding: string | undefined,
): Uint8Array {
  const coding = (encoding ?? '').trim().toLowerCase();
  try {
    switch (coding) {
      case 'gzip':
      case 'x-gzip': {
        return new Uint8Array(
          gunzipSync(bytes, { maxOutputLength: MAX_BYTES }),
        );
      }
      case 'deflate': {
        return new Uint8Array(
          inflateSync(bytes, { maxOutputLength: MAX_BYTES }),
        );
      }
      case 'br': {
        return new Uint8Array(
          brotliDecompressSync(bytes, { maxOutputLength: MAX_BYTES }),
        );
      }
      default: {
        return bytes;
      }
    }
  } catch (error) {
    throw new ProbeError(
      `the response body could not be decoded as ${coding}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** The request headers as name/value pairs, from any of the forms `fetch` accepts. */
function requestHeaders(
  init: ConstructorParameters<typeof Headers>[0] | undefined,
): [string, string][] {
  const merged = new Map<string, string>([
    ['accept', '*/*'],
    ['accept-encoding', 'gzip, deflate, br'],
    ['user-agent', USER_AGENT],
  ]);
  new Headers(init).forEach((value, name) => merged.set(name, value));
  return [...merged];
}

/** Sends one request without following a redirect. */
async function once(
  client: ProbeClient,
  url: URL,
  method: string,
  headers: readonly (readonly [string, string])[],
): Promise<Response> {
  const tls = url.protocol === 'https:';
  const defaultPort = tls ? 443 : 80;
  const request: HttpRequest = {
    host: url.hostname.replaceAll(/^\[|\]$/g, ''),
    port: url.port === '' ? defaultPort : Number(url.port),
    tls,
    method,
    path: `${url.pathname}${url.search}`,
    headers,
    nobody: method === 'HEAD',
    maxBody: MAX_BYTES + 65_536,
  };
  const answer = await client.http(request);
  const lines = new Headers();
  for (const [name, value] of answer.headers) {
    try {
      lines.append(name, value);
    } catch {
      // A header the Fetch API cannot hold is left out.
    }
  }
  let body: Uint8Array | null = null;
  if (method !== 'HEAD' && !bodyless(answer.status)) {
    const chunked = /chunked/i.test(lines.get('transfer-encoding') ?? '');
    const raw = chunked ? unchunk(answer.body) : answer.body;
    body = decode(raw, lines.get('content-encoding') ?? undefined);
    if (body.byteLength > MAX_BYTES) {
      throw new ScanRefused(`The response is larger than ${MAX_BYTES} bytes`);
    }
  }
  return new Response(body as ConstructorParameters<typeof Response>[0], {
    status: answer.status,
    statusText: answer.statusText,
    headers: lines,
  });
}

/** A `fetch` over the probe. `redirect` is honoured: `follow` (the default) up to ten hops, `manual`, or `error`. */
export function probeFetch(
  client: ProbeClient,
  maxRedirects = 10,
): typeof fetch {
  return async (input, init = {}) => {
    const first = new URL(input instanceof Request ? input.url : String(input));
    const method = (init.method ?? 'GET').toUpperCase();
    if (init.body !== undefined && init.body !== null) {
      throw new ScanRefused('A request body cannot be sent through the probe');
    }
    const redirect = init.redirect ?? 'follow';
    const headers = requestHeaders(init.headers);
    let current = first;
    let redirected = false;
    for (let hops = 0; ; hops += 1) {
      assertScannable(current);
      const response = await once(client, current, method, headers);
      const location = response.headers.get('location');
      if (REDIRECTS.has(response.status) && location && redirect !== 'manual') {
        if (redirect === 'error') {
          throw new ScanRefused(`${current.href} redirected`);
        }
        if (hops >= maxRedirects) {
          throw new ScanRefused('Too many redirects');
        }
        current = new URL(location, current);
        redirected = true;
        continue;
      }
      Object.defineProperty(response, 'url', { value: current.href });
      Object.defineProperty(response, 'redirected', { value: redirected });
      return response;
    }
  };
}
