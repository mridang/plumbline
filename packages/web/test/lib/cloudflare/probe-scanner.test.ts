import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { cloudflareWorkersStub } from '../../helpers/cloudflare-workers-stub';

jest.unstable_mockModule('cloudflare:workers', cloudflareWorkersStub, {
  virtual: true,
} as never);

const { ProbeScanner } = await import('@/lib/cloudflare/probe-scanner');

/** The answer of the probe's `/v1/http` for a response. */
const httpAnswer = (
  status: number,
  headers: [string, string][],
  body: string,
): string =>
  JSON.stringify({
    httpVersion: 'HTTP/1.1',
    status,
    statusText: 'X',
    headers,
    body: Buffer.from(body).toString('base64'),
    truncated: false,
  });

/** A probe container for a site with one page; `log` has every request the probe was sent. */
function probe(options: { down?: boolean } = {}) {
  const log: string[] = [];
  const container = {
    running: true,
    start: () => undefined,
    setInactivityTimeout: async () => undefined,
    getTcpPort: () => ({
      fetch: async (input: string, init?: RequestInit) => {
        const path = new URL(input).pathname;
        log.push(path);
        if (path === '/healthz') {
          return new Response('ok');
        }
        if (options.down) {
          throw new Error('Network connection lost');
        }
        const body = String(init?.body ?? '');
        switch (path) {
          case '/v1/roots':
            return new Response(
              '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n',
            );
          case '/v1/http':
            return new Response(
              body.includes('path=/\n')
                ? httpAnswer(
                    200,
                    [
                      ['Content-Type', 'text/html; charset=utf-8'],
                      ['Alt-Svc', 'h3=":443"'],
                    ],
                    '<!doctype html><html lang="en"><head><title>Hi</title></head><body>hi</body></html>',
                  )
                : httpAnswer(404, [['Content-Type', 'text/plain']], 'no'),
            );
          case '/v1/handshakes':
            return new Response(
              JSON.stringify({
                results: body
                  .split('--\n')
                  .map(() => ({ error: 'handshake failed: no answer' })),
              }),
            );
          case '/v1/connect':
            return new Response('{"reachable":false}');
          default:
            return new Response('{"error":"not here"}', { status: 502 });
        }
      },
    }),
  };
  return { container, log };
}

const scanner = (container: unknown) =>
  new ProbeScanner({ container } as never, {} as never);

const run = (url = 'https://example.com/') =>
  new Request('https://scanner.internal/run', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });

/** The lines of a stream, parsed. */
async function lines(
  response: Response,
): Promise<{ type: string; outcome?: { id: string; status: string } }[]> {
  const text = await response.text();
  return text
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as { type: string });
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  // The checks ask a DNS-over-HTTPS resolver for names; the tests never touch the internet.
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ Status: 3, Answer: [] }), {
      headers: { 'content-type': 'application/dns-json' },
    })) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('ProbeScanner', () => {
  it('runs every check in the object and streams them, asking the probe only for the network', async () => {
    const { container, log } = probe();
    const response = await scanner(container).fetch(run());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(
      'application/x-ndjson',
    );
    const out = await lines(response);
    expect(out[0]).toMatchObject({ type: 'ready' });
    expect(out[out.length - 1]).toEqual({ type: 'end' });
    const done = out.filter((line) => line.type === 'done');
    expect(done.length).toBeGreaterThan(250);
    expect(
      done.find((line) => line.outcome?.id === 'alt-svc')?.outcome?.status,
    ).toBe('passed');
    // Only the network is asked of the probe: pages and files, handshakes, connection tests.
    expect([...new Set(log)].sort()).toEqual([
      '/healthz',
      '/v1/connect',
      '/v1/handshakes',
      '/v1/http',
    ]);
  });

  it('breaks the stream when the probe is down, so whoever reads it knows to try again', async () => {
    const { container } = probe({ down: true });
    const response = await scanner(container).fetch(run());
    await expect(response.text()).rejects.toThrow(
      'the probe could not be reached',
    );
  });

  it('refuses a scan that has no address', async () => {
    const { container } = probe();
    const response = await scanner(container).fetch(
      new Request('https://scanner.internal/run', {
        method: 'POST',
        body: '{}',
      }),
    );
    expect(response.status).toBe(400);
  });

  it('forwards anything else to the container', async () => {
    const { container, log } = probe();
    const response = await scanner(container).fetch(
      new Request('https://scanner.internal/healthz'),
    );
    expect(await response.text()).toBe('ok');
    expect(log).toContain('/healthz');
  });
});
