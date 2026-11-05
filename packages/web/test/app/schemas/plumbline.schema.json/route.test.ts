import { describe, expect, it } from '@jest/globals';

import { GET } from '@/app/schemas/plumbline.schema.json/route';
import { SCHEMA_PATH, SCHEMA_URL } from '@/domain/suite/config-schema';
import { applyResponseHeaders } from '@/lib/core/http/headers';

const URL_OF = `https://plumbline.test${SCHEMA_PATH}`;

const get = (headers: Record<string, string> = {}) =>
  GET(new Request(URL_OF, { headers }));

describe('GET /schemas/plumbline.schema.json', () => {
  it('answers 200 with the schema, named by the address it is served at', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { $id: string; $schema: string };
    expect(body.$id).toBe(SCHEMA_URL);
    expect(body.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  });

  it('is served as a schema, for any editor or site to fetch', async () => {
    const res = await get();
    expect(res.headers.get('content-type')).toBe(
      'application/schema+json; charset=utf-8',
    );
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('may be kept by a shared cache for an hour and then reused while it is checked', async () => {
    expect((await get()).headers.get('cache-control')).toBe(
      'public, max-age=3600, stale-while-revalidate=86400',
    );
  });

  it('carries an ETag that is the same every time', async () => {
    const first = (await get()).headers.get('etag');
    expect(first).toMatch(/^"[0-9a-f]{32}"$/);
    expect((await get()).headers.get('etag')).toBe(first);
  });

  it('answers 304 with no body when the ETag is still current', async () => {
    const etag = (await get()).headers.get('etag') ?? '';
    for (const header of [etag, `W/${etag}`, `"other", ${etag}`, '*']) {
      const res = await get({ 'if-none-match': header });
      expect(res.status).toBe(304);
      expect(await res.text()).toBe('');
      expect(res.headers.get('etag')).toBe(etag);
    }
  });

  it('answers 200 again when the ETag is a different one', async () => {
    expect((await get({ 'if-none-match': '"stale"' })).status).toBe(200);
  });

  it('is left open and cacheable once the site adds its own headers', async () => {
    const res = applyResponseHeaders(new Request(URL_OF), await get());
    expect(res.headers.get('cross-origin-resource-policy')).toBe(
      'cross-origin',
    );
    expect(res.headers.get('x-robots-tag')).toBeNull();
    expect(res.headers.get('cache-control')).toBe(
      'public, max-age=3600, stale-while-revalidate=86400',
    );
  });
});
