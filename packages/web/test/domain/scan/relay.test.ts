import { describe, expect, it } from '@jest/globals';

import {
  relayFetch,
  relayFor,
  RelayError,
  type Relay,
  type RelayRequest,
  type Relayed,
} from '@/domain/scan/relay';

/** A transport that answers every call with `response`, recording the calls. */
function transport(
  response: () => Response,
  calls: { url: string; init: RequestInit | undefined }[] = [],
): typeof fetch {
  return (async (input: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return response();
  }) as typeof fetch;
}

/** The Worker's answer for a target that said `status` with `headers` and `body`. */
function upstream(
  status: number,
  headers: [string, string][],
  body: string,
  url = 'https://example.com/',
): Response {
  return new Response(body, {
    headers: {
      'Upstream-Status': String(status),
      'Upstream-Url': url,
      'Upstream-Headers': encodeURIComponent(JSON.stringify(headers)),
    },
  });
}

describe('relayFor', () => {
  it('posts the request to the scan fetches and reads the answer', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const relay = relayFor(
      'abc.def',
      transport(
        () =>
          upstream(
            404,
            [
              ['content-type', 'text/plain'],
              ['set-cookie', 'a=1'],
              ['set-cookie', 'b=2'],
            ],
            'nope',
          ),
        calls,
      ),
    );
    const relayed = await relay({
      url: 'https://example.com/',
      method: 'GET',
      headers: { accept: 'text/plain' },
    });
    expect(calls[0]?.url).toBe('/api/scans/abc.def/fetches');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      url: 'https://example.com/',
      method: 'GET',
      headers: { accept: 'text/plain' },
    });
    expect(relayed.status).toBe(404);
    expect(relayed.url).toBe('https://example.com/');
    expect(relayed.headers).toEqual([
      ['content-type', 'text/plain'],
      ['set-cookie', 'a=1'],
      ['set-cookie', 'b=2'],
    ]);
    expect(new TextDecoder().decode(relayed.body)).toBe('nope');
  });

  it('reads no headers when the Worker sent none it could parse', async () => {
    const relay = relayFor(
      'id',
      transport(
        () =>
          new Response('', {
            headers: { 'Upstream-Status': '200', 'Upstream-Headers': '%7B' },
          }),
      ),
    );
    expect(
      (await relay({ url: 'https://example.com/', method: 'GET', headers: {} }))
        .headers,
    ).toEqual([]);
  });

  it('throws the problem detail when the Worker refuses', async () => {
    const relay = relayFor(
      'id',
      transport(() =>
        Response.json(
          { detail: 'example.com did not answer.' },
          { status: 502 },
        ),
      ),
    );
    const failure = relay({
      url: 'https://example.com/',
      method: 'GET',
      headers: {},
    });
    await expect(failure).rejects.toBeInstanceOf(RelayError);
    await expect(failure).rejects.toThrow('example.com did not answer.');
  });

  it('says the status when the refusal is not a problem document', async () => {
    const relay = relayFor(
      'id',
      transport(() => new Response('', { status: 500 })),
    );
    await expect(
      relay({ url: 'https://example.com/', method: 'GET', headers: {} }),
    ).rejects.toThrow('Request failed (500).');
  });
});

/** A relay answering from a table, recording what it was asked. */
function fakeRelay(
  routes: Record<string, Omit<Relayed, 'url' | 'body'> & { body?: string }>,
  seen: RelayRequest[] = [],
): Relay {
  return async (request) => {
    seen.push(request);
    const route = routes[request.url] ?? { status: 404, headers: [] };
    return {
      status: route.status,
      headers: route.headers,
      url: request.url,
      body: new TextEncoder().encode(route.body ?? ''),
    };
  };
}

const local = (async () => new Response('local')) as unknown as typeof fetch;

describe('relayFetch', () => {
  it('answers with the target status, headers and body', async () => {
    const fetcher = relayFetch(
      fakeRelay({
        'https://example.com/': {
          status: 200,
          headers: [['content-type', 'text/plain']],
          body: 'hi',
        },
      }),
      local,
    );
    const response = await fetcher('https://example.com/');
    expect(response.status).toBe(200);
    expect(response.url).toBe('https://example.com/');
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(await response.text()).toBe('hi');
  });

  it('follows redirects unless told not to', async () => {
    const routes = {
      'https://example.com/': {
        status: 301,
        headers: [['location', '/next']] as [string, string][],
      },
      'https://example.com/next': { status: 200, headers: [], body: 'there' },
    };
    const followed = await relayFetch(
      fakeRelay(routes),
      local,
    )('https://example.com/');
    expect(followed.url).toBe('https://example.com/next');
    const manual = await relayFetch(fakeRelay(routes), local)(
      'https://example.com/',
      { redirect: 'manual' },
    );
    expect(manual.status).toBe(301);
    expect(manual.headers.get('location')).toBe('/next');
  });

  it('gives a body-less status no body', async () => {
    const response = await relayFetch(
      fakeRelay({ 'https://example.com/': { status: 304, headers: [] } }),
      local,
    )('https://example.com/');
    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
  });

  it('passes the method and headers of the call on', async () => {
    const seen: RelayRequest[] = [];
    await relayFetch(fakeRelay({}, seen), local)(
      new Request('https://example.com/a'),
      { method: 'head', headers: { Accept: 'text/html' } },
    );
    expect(seen[0]).toEqual({
      url: 'https://example.com/a',
      method: 'HEAD',
      headers: { accept: 'text/html' },
    });
  });

  it('refuses methods other than GET and HEAD', async () => {
    await expect(
      relayFetch(fakeRelay({}), local)('https://example.com/', {
        method: 'POST',
      }),
    ).rejects.toThrow('A scan can only GET or HEAD, not POST.');
  });

  it('hands addresses that are not http(s) to the local fetch', async () => {
    const response = await relayFetch(fakeRelay({}), local)('data:,x');
    expect(await response.text()).toBe('local');
  });
});
