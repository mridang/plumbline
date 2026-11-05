import { describe, expect, it } from '@jest/globals';

import {
  createScanFetches,
  createScanProbes,
  createScanRun,
  createScansCollection,
} from '@/domain/api/scans';
import type { CooldownDeps } from '@/domain/scan/cooldown';
import { issueScanId } from '@/domain/scan/token';
import type { RateLimitStore } from '@/lib/rate-limit';

const SECRET = 'test-secret';

/** A JSON POST to `path` with `body`. */
function post(path: string, body: unknown, type = 'application/json'): Request {
  return new Request(`https://app.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': type },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Cooldown counters held in a map, at a fixed time. */
function cooldown(): () => CooldownDeps {
  const counters = new Map<string, number>();
  const store: RateLimitStore = {
    async hit(key, now) {
      const count = (counters.get(key) ?? 0) + 1;
      counters.set(key, count);
      return { count, windowStart: now };
    },
    async purge() {},
  };
  return () => ({ store: () => store, now: () => 1000, random: () => 0.5 });
}

describe('POST /api/scans', () => {
  const { POST } = createScansCollection(() => SECRET, cooldown()).handlers();

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

  it('scans the canonical form of the address', async () => {
    const { POST: fresh } = createScansCollection(
      () => SECRET,
      cooldown(),
    ).handlers();
    const response = await fresh(
      post('/api/scans', { url: 'example.com.//a?utm_source=x&b=1' }),
    );
    expect(((await response.json()) as { url: string }).url).toBe(
      'https://example.com/a?b=1',
    );
  });

  it('refuses a second scan of a page within five minutes, with 429 and Retry-After', async () => {
    const { POST: once } = createScansCollection(
      () => SECRET,
      cooldown(),
    ).handlers();
    await once(post('/api/scans', { url: 'example.com/page' }));
    const again = await once(
      post('/api/scans', { url: 'https://EXAMPLE.com/page#x' }),
    );
    expect(again.status).toBe(429);
    expect(again.headers.get('retry-after')).toBe('300');
    expect(again.headers.get('content-type')).toBe('application/problem+json');
    expect(await again.json()).toMatchObject({
      type: '/problems/rate-limited',
    });
  });

  it('does not count a scan that could not be signed', async () => {
    const make = cooldown();
    const { POST: unsigned } = createScansCollection(
      () => undefined,
      make,
    ).handlers();
    await unsigned(post('/api/scans', { url: 'example.com' }));
    const { POST: signed } = createScansCollection(
      () => SECRET,
      make,
    ).handlers();
    expect(
      (await signed(post('/api/scans', { url: 'example.com' }))).status,
    ).toBe(201);
  });

  it('answers 503 when the server has no secret to sign with', async () => {
    const { POST: unsigned } = createScansCollection(
      () => undefined,
      cooldown(),
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

describe('POST /api/scans/{id}/probes', () => {
  const answered = (seen: unknown[] = []) => ({
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (request: Request) => {
        seen.push(await request.text());
        return Response.json({ protocol: 'TLSv1.3' });
      },
    }),
  });

  it('has the container make the handshake for a live scan', async () => {
    const seen: unknown[] = [];
    const { POST } = createScanProbes(
      () => SECRET,
      () => answered(seen),
    ).handlers();
    const { id } = await issueScanId('https://example.com/', SECRET);
    const response = await POST(
      post(`/api/scans/${id}/probes`, { host: 'example.com', port: 443 }),
      routeFor(id),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ protocol: 'TLSv1.3' });
    expect(seen).toEqual(['host=example.com\nport=443']);
  });

  it('answers 404 for a scan id it did not sign, and probes nothing', async () => {
    const seen: unknown[] = [];
    const { POST } = createScanProbes(
      () => SECRET,
      () => answered(seen),
    ).handlers();
    const response = await POST(
      post('/api/scans/forged.id/probes', { host: 'example.com', port: 443 }),
      routeFor('forged.id'),
    );
    expect(response.status).toBe(404);
    expect(seen).toEqual([]);
  });

  it('refuses a probe of another host than the one scanned', async () => {
    const seen: unknown[] = [];
    const { POST } = createScanProbes(
      () => SECRET,
      () => answered(seen),
    ).handlers();
    const { id } = await issueScanId('https://example.com/', SECRET);
    const response = await POST(
      post(`/api/scans/${id}/probes`, { host: 'other.test', port: 443 }),
      routeFor(id),
    );
    expect(response.status).toBe(400);
    expect(seen).toEqual([]);
  });

  it('answers 502 when the handshake fails and 503 when there is no container', async () => {
    const { id } = await issueScanId('https://example.com/', SECRET);
    const failing = {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async () => Response.json({ error: 'timeout' }, { status: 502 }),
      }),
    };
    const down = createScanProbes(
      () => SECRET,
      () => failing,
    ).handlers();
    const failed = await down.POST(
      post(`/api/scans/${id}/probes`, { host: 'example.com', port: 443 }),
      routeFor(id),
    );
    expect(failed.status).toBe(502);
    const none = createScanProbes(
      () => SECRET,
      () => undefined,
    ).handlers();
    const missing = await none.POST(
      post(`/api/scans/${id}/probes`, { host: 'example.com', port: 443 }),
      routeFor(id),
    );
    expect(missing.status).toBe(503);
  });
});

describe('POST /api/scans/{id}/run', () => {
  const streaming = (seen: unknown[] = []) => ({
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (request: Request) => {
        seen.push(await request.json());
        return new Response('{"type":"end"}\n', {
          headers: { 'content-type': 'application/x-ndjson' },
        });
      },
    }),
  });

  it('has the scanner run the scan’s address and streams its answer', async () => {
    const seen: unknown[] = [];
    const { POST } = createScanRun(
      () => SECRET,
      () => streaming(seen),
      cooldown(),
    ).handlers();
    const { id } = await issueScanId('https://example.com/', SECRET);
    const response = await POST(
      new Request(`https://app.test/api/scans/${id}/run`, { method: 'POST' }),
      routeFor(id),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/x-ndjson');
    expect(await response.text()).toBe('{"type":"end"}\n');
    expect(seen).toEqual([{ url: 'https://example.com/' }]);
  });

  it('runs a scan’s checks once: 429 for a second run with the same id', async () => {
    const seen: unknown[] = [];
    const { POST } = createScanRun(
      () => SECRET,
      () => streaming(seen),
      cooldown(),
    ).handlers();
    const { id } = await issueScanId('https://example.com/', SECRET);
    const run = () =>
      POST(
        new Request(`https://app.test/api/scans/${id}/run`, {
          method: 'POST',
        }),
        routeFor(id),
      );
    expect((await run()).status).toBe(200);
    const again = await run();
    expect(again.status).toBe(429);
    expect(again.headers.get('content-type')).toBe('application/problem+json');
    expect(seen).toHaveLength(1);
  });

  it('answers 404 for a scan id it did not sign, and runs nothing', async () => {
    const seen: unknown[] = [];
    const { POST } = createScanRun(
      () => SECRET,
      () => streaming(seen),
      cooldown(),
    ).handlers();
    const response = await POST(
      new Request('https://app.test/api/scans/forged.id/run', {
        method: 'POST',
      }),
      routeFor('forged.id'),
    );
    expect(response.status).toBe(404);
    expect(seen).toEqual([]);
  });

  it('answers 503 as a problem when there is no scanner, or it does not answer', async () => {
    const { id } = await issueScanId('https://example.com/', SECRET);
    const call = (namespace: ReturnType<typeof streaming> | undefined) =>
      createScanRun(
        () => SECRET,
        () => namespace,
        cooldown(),
      )
        .handlers()
        .POST(
          new Request(`https://app.test/api/scans/${id}/run`, {
            method: 'POST',
          }),
          routeFor(id),
        );
    const none = await call(undefined);
    expect(none.status).toBe(503);
    expect(none.headers.get('content-type')).toBe('application/problem+json');
    const down = await call({
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async () => new Response('no', { status: 503 }),
      }),
    });
    expect(down.status).toBe(503);
  });

  it('answers 503 when the server has no secret', async () => {
    const { POST } = createScanRun(
      () => undefined,
      () => streaming(),
      cooldown(),
    ).handlers();
    const response = await POST(
      new Request('https://app.test/api/scans/x.y/run', { method: 'POST' }),
      routeFor('x.y'),
    );
    expect(response.status).toBe(503);
  });
});
