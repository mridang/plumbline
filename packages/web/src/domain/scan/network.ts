/**
 * @packageDocumentation
 *
 * Fetching a resource the way webhint's connectors describe it to hints: the
 * final response's status, headers (lower-cased, repeated ones joined), media
 * type, charset and body, plus the redirect hops on the way there. Every
 * request goes through the Worker (see `relay.ts`), one hop at a time, so the
 * hops are known.
 */

import type { NetworkData } from 'hint';
import type { HttpHeaders } from '@hint/utils-types';

import type { Relay, Relayed } from './relay';

/** How many redirects are followed before giving up, as browsers roughly do. */
const MAX_REDIRECTS = 10;

/** Response headers as webhint hands them to hints: lower-case names, one string each. */
export function headersOf(pairs: Relayed['headers']): HttpHeaders {
  const out: HttpHeaders = {};
  for (const [name, value] of pairs) {
    const key = name.toLowerCase();
    const before = out[key];
    // Repeated Set-Cookie lines are kept one per line, since a cookie may hold
    // a comma; other repeated headers are a comma list, as HTTP allows.
    out[key] =
      before === undefined
        ? value
        : `${before}${key === 'set-cookie' ? '\n' : ', '}${value}`;
  }
  return out;
}

/** The media type and charset of a `Content-Type` value. */
export function contentTypeOf(value: string | undefined): {
  mediaType: string;
  charset: string;
} {
  const [essence = '', ...params] = (value ?? '').split(';');
  const charset =
    params
      .map((p) => p.trim())
      .find((p) => p.toLowerCase().startsWith('charset='))
      ?.slice('charset='.length)
      .replace(/"/g, '')
      .toLowerCase() ?? '';
  return { mediaType: essence.trim().toLowerCase(), charset };
}

/** Text in the charset the server named, or UTF-8 when it named none we know. */
function decode(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset || 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/** Whether a status asks the client to go somewhere else. */
function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

/**
 * Fetch `url` through `relay` and describe the final response as webhint does.
 * Redirects are followed (up to ten) and listed in `hops`, oldest first.
 * Throws when the address cannot be reached at all, as webhint's
 * `fetchContent` does.
 *
 * @param url The address to fetch.
 * @param requestHeaders Extra request headers a hint asked for.
 * @param relay How a request reaches the target.
 */
export async function fetchResource(
  url: URL | string,
  requestHeaders: Readonly<Record<string, string>>,
  relay: Relay,
): Promise<NetworkData> {
  const hops: string[] = [];
  let current = new URL(url);
  for (;;) {
    const relayed = await relay({
      url: current.href,
      method: 'GET',
      headers: requestHeaders,
    });
    const headers = headersOf(relayed.headers);
    const location = headers['location'];
    if (isRedirect(relayed.status) && location && hops.length < MAX_REDIRECTS) {
      hops.push(current.href);
      current = new URL(location, current);
      continue;
    }
    const { mediaType, charset } = contentTypeOf(headers['content-type']);
    const content = decode(relayed.body, charset);
    // Image hints sniff the raw bytes with Buffer's readers; the view shares
    // the bytes, it does not copy them.
    const rawContent = Buffer.from(
      relayed.body.buffer,
      relayed.body.byteOffset,
      relayed.body.byteLength,
    );
    return {
      request: { headers: { ...requestHeaders }, url: current.href },
      response: {
        body: {
          content,
          rawContent,
          rawResponse: () => Promise.resolve(rawContent),
        },
        charset,
        headers,
        hops,
        mediaType,
        statusCode: relayed.status,
        url: current.href,
      },
    };
  }
}
