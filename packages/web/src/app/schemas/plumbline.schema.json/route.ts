/**
 * The JSON Schema of `plumbline.yaml`.
 *
 *   GET /schemas/plumbline.schema.json → 200 the schema, 304 when `If-None-Match` is its ETag
 *
 * A document for editors, not part of the REST contract, so it lives outside
 * `/api` (the `api-design` skill) and is not in `openapi.json`. The behaviour is
 * in `buildSchema`; this file only serves it, with the headers an editor and a
 * shared cache need: the schema media type, a permissive CORS header (editors
 * and web tools fetch it from other origins), an ETag and a short public cache.
 */

import { buildSchema } from '@/domain/suite/config-schema';

/** Built once per instance: it only changes with a new build. */
const BODY = `${JSON.stringify(buildSchema(), null, 2)}\n`;

/** The first 16 bytes of the body's SHA-256, as hex, quoted: a strong validator. */
async function etagOf(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  const hex = [...new Uint8Array(digest).slice(0, 16)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `"${hex}"`;
}

const ETAG = etagOf(BODY);

/** Whether the request's `If-None-Match` lists `etag` (or `*`). */
function matches(header: string | null, etag: string): boolean {
  return (
    header !== null &&
    header
      .split(',')
      .map((part) => part.trim().replace(/^W\//, ''))
      .some((part) => part === '*' || part === etag)
  );
}

/** `GET /schemas/plumbline.schema.json`. Needs no sign-in. */
export async function GET(request: Request): Promise<Response> {
  const etag = await ETAG;
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    ETag: etag,
  };
  if (matches(request.headers.get('if-none-match'), etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(BODY, {
    status: 200,
    headers: {
      ...headers,
      // Editors accept `application/json` too; this is the registered type.
      'Content-Type': 'application/schema+json; charset=utf-8',
    },
  });
}
