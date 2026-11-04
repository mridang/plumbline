import { describe, expect, test } from '@jest/globals';
import type { HubNamespace } from '@/lib/cloudflare/broadcaster';
import { openEventStream } from '@/lib/cloudflare/event-stream';

describe('openEventStream', () => {
  test('forwards to the hub of the person with the resume position and returns its stream', async () => {
    const fetched: { url: string; headers: unknown }[] = [];
    const names: string[] = [];
    const stream = new ReadableStream<Uint8Array>();
    const hubs = {
      idFromName: (name: string) => {
        names.push(name);
        return name;
      },
      get: () => ({
        fetch: async (url: string, init: { headers: unknown }) => {
          fetched.push({ url, headers: init.headers });
          return new Response(stream);
        },
      }),
    } as unknown as HubNamespace;

    const response = await openEventStream(hubs, '1', 12);

    expect(names).toEqual(['1']);
    expect(fetched).toEqual([
      {
        url: 'https://hub.internal/events/people/1',
        headers: { 'Last-Event-ID': '12' },
      },
    ]);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.body).toBe(stream);
  });

  test('asks for only what is new when the client has seen nothing', async () => {
    const fetched: unknown[] = [];
    const hubs = {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async (_url: string, init: { headers: unknown }) => {
          fetched.push(init.headers);
          return new Response(new ReadableStream<Uint8Array>());
        },
      }),
    } as unknown as HubNamespace;

    await openEventStream(hubs, '1', null);

    expect(fetched).toEqual([{}]);
  });
});
