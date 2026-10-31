import { describe, expect, it } from '@jest/globals';

import { createScanFetches, createScansCollection } from '@/domain/api/scans';
import { issueScanId } from '@/domain/scan/token';

const SECRET = 'test-secret';

/** A JSON POST to `path` with `body`. */
function post(path: string, body: unknown, type = 'application/json'): Request {
  return new Request(`https://app.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': type },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/scans', () => {
  const { POST } = createScansCollection(() => SECRET).handlers();

  it('starts a scan: 201, its id and where it lives', async () => {
    const response = await POST(
      post('/api/scans', { url: 'Example.com/a#top' }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, string>;
    expect(body['url']).toBe('https://example.com/a');
    expect(Number.isNaN(Date.parse(body['expires_at'] ?? ''))).toBe(false);
    expect(response.headers.get('location')).toBe(
      `https://app.test/api/scans/${body['id']}`,
    );
  });

  it.each([
    ['not JSON', 'url=example.com', 'text/plain', 415],
    ['not an object', '"example.com"', 'application/json', 400],
  ])('refuses a body that is %s', async (_label, body, type, status) => {
    const response = await POST(post('/api/scans', body, type));
    expect(response.status).toBe(status);
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json',
    );
  });

  it('refuses a scan with no address, naming the field', async () => {
    const response = await POST(post('/api/scans', {}));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      detail: 'Say which site to scan.',
      errors: ['url: must be a string'],
    });
  });

  it('refuses an address that is not a public site', async () => {
    const response = await POST(post('/api/scans', { url: 'localhost' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      detail: 'Only public domains can be scanned.',
      errors: ['url: Only public domains can be scanned.'],
    });
  });

  it('answers 503 when the server has no secret to sign with', async () => {
    const { POST: unsigned } = createScansCollection(
      () => undefined,
    ).handlers();
    const response = await unsigned(post('/api/scans', { url: 'example.com' }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      type: '/problems/not-configured',
    });
  });
});

/** A fetch that answers `response`, recording the addresses asked for. */
function target(response: () => Response, seen: string[] = []): typeof fetch {
  return (async (input: URL | RequestInfo) => {
    seen.push(String(input));
    return response();
  }) as typeof fetch;
}

/** The route context for scan `id`. */
const routeFor = (id: string) => ({ params: Promise.resolve({ id }) });

describe('POST /api/scans/{id}/fetches', () => {
  it('fetches for a live scan and passes the answer on', async () => {
    const seen: string[] = [];
    const { POST } = createScanFetches(
      () => SECRET,
      target(() => new Response('hello', { status: 418 }), seen),
    ).handlers();
    const { id } = await issueScanId('https://example.com/', SECRET);
    const response = await POST(
      post(`/api/scans/${id}/fetches`, {
        url: 'https://example.com/robots.txt',
      }),
      routeFor(id),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('upstream-status')).toBe('418');
    expect(await response.text()).toBe('hello');
    expect(seen).toEqual(['https://example.com/robots.txt']);
  });

  it('answers 404 for a scan id it did not sign', async () => {
    const { POST } = createScanFetches(
      () => SECRET,
      target(() => new Response('')),
    ).handlers();
    const response = await POST(
      post('/api/scans/forged.id/fetches', { url: 'https://example.com/' }),
      routeFor('forged.id'),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      detail: 'No such scan, or it has ended.',
    });
  });

  it('refuses a fetch that is not valid, naming the fields', async () => {
    const { POST } = createScanFetches(
      () => SECRET,
      target(() => new Response('')),
    ).handlers();
    const { id } = await issueScanId('https://example.com/', SECRET);
    const response = await POST(
      post(`/api/scans/${id}/fetches`, {
        url: 'http://10.0.0.1/',
        method: 'DELETE',
      }),
      routeFor(id),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errors: [
        'url: must be a public http or https address',
        'method: must be GET or HEAD',
      ],
    });
  });

  it('refuses a body that is not an object', async () => {
    const { POST } = createScanFetches(
      () => SECRET,
      target(() => new Response('')),
    ).handlers();
    const { id } = await issueScanId('https://example.com/', SECRET);
    const response = await POST(
      post(`/api/scans/${id}/fetches`, '[]'),
      routeFor(id),
    );
    expect(response.status).toBe(400);
  });

  it('answers 502 when the target does not answer', async () => {
    const { POST } = createScanFetches(() => SECRET, (() =>
      Promise.reject(new TypeError('refused'))) as typeof fetch).handlers();
    const { id } = await issueScanId('https://example.com/', SECRET);
    const response = await POST(
      post(`/api/scans/${id}/fetches`, { url: 'https://example.com/' }),
      routeFor(id),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      type: '/problems/unreachable',
      detail: 'example.com did not answer.',
    });
  });

  it('answers 503 when the server has no secret', async () => {
    const { POST } = createScanFetches(
      () => undefined,
      target(() => new Response('')),
    ).handlers();
    const response = await POST(
      post('/api/scans/x.y/fetches', { url: 'https://example.com/' }),
      routeFor('x.y'),
    );
    expect(response.status).toBe(503);
  });
});
