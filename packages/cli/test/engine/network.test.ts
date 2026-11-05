import { describe, expect, it } from '@jest/globals';
import {
  contentTypeOf,
  fetchResource,
  headersOf,
} from '../../src/engine/network.js';

describe('headersOf', () => {
  it('lower-cases names, joins repeats and keeps each Set-Cookie on its own line', () => {
    const headers = new Headers();
    headers.append('Vary', 'accept');
    headers.append('Vary', 'cookie');
    headers.append('Set-Cookie', 'a=1; Expires=Wed, 01 Jan 2031 00:00:00 GMT');
    headers.append('Set-Cookie', 'b=2');
    expect(headersOf(headers)).toEqual({
      vary: 'accept, cookie',
      'set-cookie': 'a=1; Expires=Wed, 01 Jan 2031 00:00:00 GMT\nb=2',
    });
  });
});

describe('contentTypeOf', () => {
  it('splits the media type from the charset', () => {
    expect(contentTypeOf('Text/HTML; charset="UTF-8"')).toEqual({
      mediaType: 'text/html',
      charset: 'utf-8',
    });
    expect(contentTypeOf(undefined)).toEqual({ mediaType: '', charset: '' });
  });
});

describe('fetchResource', () => {
  /** A fetch that answers from a table of address → response. */
  const answering =
    (table: Record<string, () => Response>): typeof fetch =>
    async (input) => {
      const answer = table[String(input)];
      if (!answer) {
        throw new Error(`unexpected ${String(input)}`);
      }
      return answer();
    };

  it('follows redirects, remembers the hops and decodes with the charset', async () => {
    const data = await fetchResource(
      'https://a.example/',
      { accept: 'text/html' },
      answering({
        'https://a.example/': () =>
          new Response(null, {
            status: 301,
            headers: { location: 'https://b.example/page' },
          }),
        'https://b.example/page': () =>
          new Response(Buffer.from('caf\xe9', 'latin1'), {
            status: 200,
            headers: { 'content-type': 'text/html; charset=iso-8859-1' },
          }),
      }),
    );
    expect(data.response.url).toBe('https://b.example/page');
    expect(data.response.hops).toEqual(['https://a.example/']);
    expect(data.response.statusCode).toBe(200);
    expect(data.response.mediaType).toBe('text/html');
    expect(data.response.body.content).toBe('café');
    expect(data.response.body.rawContent.length).toBe(4);
    expect(data.request).toEqual({
      headers: { accept: 'text/html' },
      url: 'https://b.example/page',
    });
  });

  it('stops following after ten redirects and returns the last redirect', async () => {
    const data = await fetchResource(
      'https://a.example/',
      {},
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://a.example/' },
        }),
    );
    expect(data.response.statusCode).toBe(302);
    expect(data.response.hops).toHaveLength(10);
  });

  it('falls back to UTF-8 for a charset it does not know', async () => {
    const data = await fetchResource(
      'https://a.example/',
      {},
      answering({
        'https://a.example/': () =>
          new Response('ok', {
            headers: { 'content-type': 'text/plain; charset=not-a-charset' },
          }),
      }),
    );
    expect(data.response.body.content).toBe('ok');
  });
});
