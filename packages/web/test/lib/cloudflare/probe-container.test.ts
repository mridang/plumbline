import { describe, expect, it, jest } from '@jest/globals';

import { cloudflareWorkersStub } from '../../helpers/cloudflare-workers-stub';

jest.unstable_mockModule('cloudflare:workers', cloudflareWorkersStub, {
  virtual: true,
} as never);

const { ProbeContainer, IDLE_MS } =
  await import('@/lib/cloudflare/probe-container');

/** A container that records how it is used; it answers once `ready` calls have failed. */
function fake(options: { running?: boolean; failures?: number } = {}) {
  const log: string[] = [];
  let failures = options.failures ?? 0;
  const container = {
    running: options.running ?? false,
    start: (startup: unknown) => {
      log.push(`start ${JSON.stringify(startup)}`);
      container.running = true;
    },
    setInactivityTimeout: async (ms: number | bigint) => {
      log.push(`idle ${ms}`);
    },
    getTcpPort: (port: number) => ({
      fetch: async (input: string, init?: RequestInit) => {
        log.push(`${init?.method ?? 'GET'} ${port} ${input}`);
        if (input.endsWith('/healthz')) {
          if (failures > 0) {
            failures -= 1;
            throw new Error('not listening');
          }
          return new Response('ok');
        }
        return Response.json({ seen: String(init?.body ?? '') });
      },
    }),
  };
  return { container, log };
}

const hub = (container: unknown) =>
  new ProbeContainer({ container } as never, {} as never);

const post = () =>
  new Request('https://probe.internal/handshake', {
    method: 'POST',
    body: '{"host":"example.com"}',
  });

describe('ProbeContainer', () => {
  it('starts the container with internet, sets its idle time and forwards the request', async () => {
    const { container, log } = fake();
    const response = await hub(container).fetch(post());
    expect(response.status).toBe(200);
    expect(log.slice(0, 2)).toEqual([
      'start {"enableInternet":true}',
      `idle ${IDLE_MS}`,
    ]);
    expect(log.at(-1)).toBe('POST 8080 http://probe/handshake');
  });

  it('does not start a container that is already running', async () => {
    const { container, log } = fake({ running: true });
    await hub(container).fetch(post());
    expect(log.some((line) => line.startsWith('start'))).toBe(false);
  });

  it('waits for a starting container to answer', async () => {
    const { container, log } = fake({ failures: 2 });
    const response = await hub(container).fetch(post());
    expect(response.status).toBe(200);
    expect(log.filter((line) => line.endsWith('/healthz'))).toHaveLength(3);
  });

  it('answers 503 when no container is bound', async () => {
    expect((await hub(undefined).fetch(post())).status).toBe(503);
  });
});
