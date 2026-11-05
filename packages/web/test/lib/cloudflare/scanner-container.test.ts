import { describe, expect, it, jest } from '@jest/globals';

import { cloudflareWorkersStub } from '../../helpers/cloudflare-workers-stub';

jest.unstable_mockModule('cloudflare:workers', cloudflareWorkersStub, {
  virtual: true,
} as never);

const { ScannerContainer, IDLE_MS, START_TIMEOUT_MS } =
  await import('@/lib/cloudflare/scanner-container');

/** A container that records how it is used; it answers once `failures` health checks have failed. */
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
        const lines = ['{"type":"ready"}\n', '{"type":"end"}\n'];
        return new Response(
          new ReadableStream({
            start(controller) {
              for (const line of lines) {
                controller.enqueue(new TextEncoder().encode(line));
              }
              controller.close();
            },
          }),
          { headers: { 'content-type': 'application/x-ndjson' } },
        );
      },
    }),
  };
  return { container, log };
}

const hub = (container: unknown) =>
  new ScannerContainer({ container } as never, {} as never);

const run = () =>
  new Request('https://scanner.internal/run', {
    method: 'POST',
    body: '{"url":"https://example.com/"}',
  });

describe('ScannerContainer', () => {
  it('starts the container with internet, sets its idle time and forwards the request', async () => {
    const { container, log } = fake();
    const response = await hub(container).fetch(run());
    expect(response.status).toBe(200);
    expect(log.slice(0, 2)).toEqual([
      'start {"enableInternet":true}',
      `idle ${IDLE_MS}`,
    ]);
    expect(log.at(-1)).toBe('POST 8080 http://scanner/run');
  });

  it('hands the answer back as a stream, line by line', async () => {
    const { container } = fake({ running: true });
    const response = await hub(container).fetch(run());
    expect(response.headers.get('content-type')).toBe('application/x-ndjson');
    expect(await response.text()).toBe('{"type":"ready"}\n{"type":"end"}\n');
  });

  it('does not start a container that is already running, but renews its idle time', async () => {
    const { container, log } = fake({ running: true });
    await hub(container).fetch(run());
    expect(log.some((line) => line.startsWith('start'))).toBe(false);
    expect(log).toContain(`idle ${IDLE_MS}`);
  });

  it('waits for a starting container to answer', async () => {
    const { container, log } = fake({ failures: 2 });
    const response = await hub(container).fetch(run());
    expect(response.status).toBe(200);
    expect(log.filter((line) => line.endsWith('/healthz'))).toHaveLength(3);
  });

  it('gives up with 503 when the container never answers', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    try {
      const { container } = fake({ failures: Number.MAX_SAFE_INTEGER });
      const pending = hub(container).fetch(run());
      await jest.advanceTimersByTimeAsync(START_TIMEOUT_MS + 1000);
      expect((await pending).status).toBe(503);
    } finally {
      jest.useRealTimers();
    }
  });

  it('answers 503 when no container is bound', async () => {
    expect((await hub(undefined).fetch(run())).status).toBe(503);
  });
});
