import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import type { FromWorker, ToWorker } from '@/domain/scan/messages';

const PAGE =
  '<!doctype html><html><head><title>Hi</title></head><body></body></html>';

/** What the worker posted. */
const posted: FromWorker[] = [];
/** The fetch the worker had before it replaced it with the relay. */
const realFetch = globalThis.fetch;
/** The calls to the server the worker made. */
const calls: string[] = [];

/** The server: relays example.com, refuses down.example. */
function server(
  input: URL | RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  calls.push(String(input));
  const { url } = JSON.parse(String(init?.body)) as { url: string };
  if (url.startsWith('https://down.example')) {
    return Promise.resolve(
      Response.json(
        { detail: 'down.example did not answer.' },
        { status: 502 },
      ),
    );
  }
  return Promise.resolve(
    new Response(url.endsWith('/') ? PAGE : '', {
      headers: {
        'Upstream-Status': url.endsWith('/') ? '200' : '404',
        'Upstream-Url': url,
        'Upstream-Headers': encodeURIComponent(
          JSON.stringify([['content-type', 'text/html']]),
        ),
      },
    }),
  );
}

/** Send the worker `message` and wait for its next reply. */
async function send(message: ToWorker): Promise<FromWorker> {
  const before = posted.length;
  (
    globalThis as unknown as { onmessage: (e: { data: ToWorker }) => void }
  ).onmessage({
    data: message,
  });
  for (let i = 0; i < 2000 && posted.length === before; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return posted[before] as FromWorker;
}

beforeAll(async () => {
  globalThis.fetch = jest.fn(server) as unknown as typeof fetch;
  (
    globalThis as unknown as { postMessage: (m: FromWorker) => void }
  ).postMessage = (m) => void posted.push(m);
  await import('@/domain/scan/worker');
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

describe('the scan worker', () => {
  it('says the page did not answer, in the server words', async () => {
    expect(
      await send({ type: 'load', scanId: 'id', url: 'https://down.example/' }),
    ).toEqual({ type: 'unreachable', detail: 'down.example did not answer.' });
  });

  it('loads the page through the relay and lists every hint', async () => {
    const ready = await send({
      type: 'load',
      scanId: 'scan.id',
      url: 'https://example.com/',
    });
    expect(ready).toMatchObject({
      type: 'ready',
      finalUrl: 'https://example.com/',
      status: 200,
    });
    expect(ready.type === 'ready' && ready.hints.length).toBeGreaterThan(200);
    expect(calls).toContain('/api/scans/scan.id/fetches');
  });

  it('runs the hint it is handed and says what it found', async () => {
    const done = await send({ type: 'run', id: 'seo-title-missing' });
    expect(done).toMatchObject({
      type: 'done',
      outcome: { id: 'seo-title-missing' },
    });
  });
});
