import { describe, expect, it } from '@jest/globals';

import { contentTypeOf, fetchResource, headersOf } from '@/domain/scan/network';
import type { Relay, RelayRequest, Relayed } from '@/domain/scan/relay';

/** A relay that answers from a table of routes, and records what it was asked. */
function fakeRelay(
  routes: Record<string, Omit<Relayed, 'url'>>,
  seen: RelayRequest[] = [],
): Relay {
  return async (request) => {
    seen.push(request);
    const route = routes[request.url];
    if (!route) {
      throw new TypeError(`no route for ${request.url}`);
    }
    return { ...route, url: request.url };
  };
}

/** Bytes of `text`. */
const bytes = (text: string) => new TextEncoder().encode(text);

describe('headersOf', () => {
  it('lower-cases names and keeps each Set-Cookie on its own line', () => {
    expect(
      headersOf([
        ['X-Thing', 'a'],
        ['set-cookie', 'a=1'],
        ['set-cookie', 'b=2'],
      ]),
    ).toEqual({ 'x-thing': 'a', 'set-cookie': 'a=1\nb=2' });
  });

  it('joins other repeated headers with commas', () => {
    expect(
      headersOf([
        ['vary', 'Accept'],
        ['vary', 'Origin'],
      ]),
    ).toEqual({ vary: 'Accept, Origin' });
  });
});

describe('contentTypeOf', () => {
  it('splits the media type from the charset', () => {
    expect(contentTypeOf('Text/HTML; Charset="ISO-8859-1"')).toEqual({
      mediaType: 'text/html',
      charset: 'iso-8859-1',
    });
  });

  it('is empty when there is no Content-Type', () => {
    expect(contentTypeOf(undefined)).toEqual({ mediaType: '', charset: '' });
  });
});

describe('fetchResource', () => {
  it('describes the response as webhint does', async () => {
    const data = await fetchResource(
      'https://example.com/',
      {},
      fakeRelay({
        'https://example.com/': {
          status: 200,
          headers: [['content-type', 'text/html; charset=utf-8']],
          body: bytes('<p>hi</p>'),
        },
      }),
    );
    expect(data.response).toMatchObject({
      statusCode: 200,
      url: 'https://example.com/',
      mediaType: 'text/html',
      charset: 'utf-8',
      hops: [],
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
    expect(data.response.body.content).toBe('<p>hi</p>');
    expect(data.response.body.rawContent.toString('utf8')).toBe('<p>hi</p>');
    expect((await data.response.body.rawResponse()).length).toBe(9);
  });

  it('follows redirects one hop at a time and lists them', async () => {
    const seen: RelayRequest[] = [];
    const data = await fetchResource(
      'http://example.com/',
      {},
      fakeRelay(
        {
          'http://example.com/': {
            status: 301,
            headers: [['location', 'https://example.com/']],
            body: bytes(''),
          },
          'https://example.com/': {
            status: 302,
            headers: [['location', '/home']],
            body: bytes(''),
          },
          'https://example.com/home': {
            status: 200,
            headers: [],
            body: bytes('ok'),
          },
        },
        seen,
      ),
    );
    expect(data.response.url).toBe('https://example.com/home');
    expect(data.response.hops).toEqual([
      'http://example.com/',
      'https://example.com/',
    ]);
    expect(seen.map((request) => request.url)).toHaveLength(3);
  });

  it('stops following after ten redirects and describes the last', async () => {
    const loop = fakeRelay(
      Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [
          `https://example.com/${i}`,
          {
            status: 302,
            headers: [['location', `/${i + 1}`]] as [string, string][],
            body: bytes(''),
          },
        ]),
      ),
    );
    const data = await fetchResource('https://example.com/0', {}, loop);
    expect(data.response.hops).toHaveLength(10);
    expect(data.response.statusCode).toBe(302);
  });

  it('sends the request headers a hint asked for, as a GET', async () => {
    const seen: RelayRequest[] = [];
    const data = await fetchResource(
      'https://example.com/',
      { accept: 'text/plain' },
      fakeRelay(
        {
          'https://example.com/': { status: 200, headers: [], body: bytes('') },
        },
        seen,
      ),
    );
    expect(seen[0]).toEqual({
      url: 'https://example.com/',
      method: 'GET',
      headers: { accept: 'text/plain' },
    });
    expect(data.request.headers).toEqual({ accept: 'text/plain' });
  });

  it('decodes the body in the charset the server named', async () => {
    const data = await fetchResource(
      'https://example.com/',
      {},
      fakeRelay({
        'https://example.com/': {
          status: 200,
          headers: [['content-type', 'text/plain; charset=iso-8859-1']],
          body: new Uint8Array([0x63, 0x61, 0x66, 0xe9]),
        },
      }),
    );
    expect(data.response.body.content).toBe('café');
  });

  it('falls back to UTF-8 for a charset it does not know', async () => {
    const data = await fetchResource(
      'https://example.com/',
      {},
      fakeRelay({
        'https://example.com/': {
          status: 200,
          headers: [['content-type', 'text/plain; charset=no-such-thing']],
          body: bytes('café'),
        },
      }),
    );
    expect(data.response.body.content).toBe('café');
  });

  it('throws when the relay cannot reach the target', async () => {
    await expect(
      fetchResource('https://example.com/', {}, fakeRelay({})),
    ).rejects.toThrow('no route');
  });
});
