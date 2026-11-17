import type { NetworkData } from 'hint';
import type { HttpHeaders } from '@hint/utils-types';

/**
 * Fetching a resource the way webhint's `fetchContent` does: follow the
 * redirects (remembering each hop), decode the body with the charset the
 * server named, and hand back the request, the final response and the bytes.
 */

/** The most redirects followed. */
const MAX_REDIRECTS = 10;

/** The headers as a plain object, names in lower case. Repeated headers are joined; `Set-Cookie` lines are kept one per line, since a cookie may hold a comma. */
export function headersOf(headers: Headers): HttpHeaders {
  const cookies = headers.getSetCookie();
  return {
    ...Object.fromEntries(
      [...headers.entries()].filter(([name]) => name !== 'set-cookie'),
    ),
    ...(cookies.length > 0 ? { 'set-cookie': cookies.join('\n') } : {}),
  };
}

/** The media type and charset a `Content-Type` names. */
interface ContentType {
  mediaType: string;
  charset: string;
}

/** The media type and charset a `Content-Type` names. */
export function contentTypeOf(value: string | undefined): ContentType {
  const [essence = '', ...params] = (value ?? '').split(';');
  const charset =
    params
      .map((p) => p.trim())
      .find((p) => p.toLowerCase().startsWith('charset='))
      ?.slice('charset='.length)
      .replaceAll('"', '')
      .toLowerCase() ?? '';
  return { mediaType: essence.trim().toLowerCase(), charset };
}

/** The bytes as text in `charset`, UTF-8 when it is unknown. */
function decode(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset || 'utf8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/** Whether a status is a redirect that names a place to go. */
function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

/**
 * Fetch `url` with `requestHeaders` through `fetcher` (a guarded `fetch`),
 * following up to ten redirects by hand so the hops are known.
 */
export async function fetchResource(
  url: URL | string,
  requestHeaders: Readonly<Record<string, string>>,
  fetcher: typeof fetch,
): Promise<NetworkData> {
  const follow = async (current: URL, hops: string[]): Promise<NetworkData> => {
    const response = await fetcher(current.href, {
      method: 'GET',
      headers: requestHeaders,
      redirect: 'manual',
    });
    const headers = headersOf(response.headers);
    const location = headers.location;
    if (
      isRedirect(response.status) &&
      location &&
      hops.length < MAX_REDIRECTS
    ) {
      return follow(new URL(location, current), [...hops, current.href]);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const { mediaType, charset } = contentTypeOf(headers['content-type']);
    const content = decode(bytes, charset);
    // Image hints sniff the raw bytes with Buffer's readers.
    const rawContent = Buffer.from(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    );
    return {
      request: { headers: { ...requestHeaders }, url: current.href },
      response: {
        body: {
          content,
          rawContent,
          rawResponse: async () => rawContent,
        },
        charset,
        headers,
        hops,
        mediaType,
        statusCode: response.status,
        url: current.href,
      },
    };
  };
  return follow(new URL(url), []);
}
