import { describe, expect, it } from '@jest/globals';

import {
  forward,
  headerPairs,
  MAX_BODY_BYTES,
  parseForwardRequest,
  UnreachableError,
  USER_AGENT,
} from '@/domain/scan/forward';

describe('parseForwardRequest', () => {
  it('keeps a GET of a public address with the allowed headers', () => {
    expect(
      parseForwardRequest({
        url: 'https://example.com/a',
        headers: { Accept: 'text/html', Cookie: 'secret=1' },
      }),
    ).toEqual({
      ok: true,
      value: {
        url: 'https://example.com/a',
        method: 'GET',
        headers: { accept: 'text/html' },
      },
    });
  });

  it('takes a HEAD', () => {
    expect(
      parseForwardRequest({ url: 'https://example.com/', method: 'HEAD' }),
    ).toMatchObject({ ok: true, value: { method: 'HEAD' } });
  });

  it.each([
    [
      'a private name',
      { url: 'http://printer.local/' },
      'url: must be a public http or https address',
    ],
    [
      'an IP address',
      { url: 'http://10.0.0.1/' },
      'url: must be a public http or https address',
    ],
    [
      'another scheme',
      { url: 'ftp://example.com/' },
      'url: must be a public http or https address',
    ],
    ['no address', {}, 'url: must be a public http or https address'],
    [
      'another method',
      { url: 'https://example.com/', method: 'POST' },
      'method: must be GET or HEAD',
    ],
    [
      'headers that are not an object',
      { url: 'https://example.com/', headers: [] },
      'headers: must be an object',
    ],
    [
      'a header that is not a string',
      { url: 'https://example.com/', headers: { accept: 1 } },
      'headers.accept: must be a string',
    ],
  ])('refuses %s', (_label, body, error) => {
    expect(parseForwardRequest(body)).toEqual({ ok: false, errors: [error] });
  });
});

describe('headerPairs', () => {
  it('lower-cases names and keeps each Set-Cookie apart', () => {
    const headers = new Headers({ 'X-Thing': 'a' });
    headers.append('Set-Cookie', 'a=1, b');
    headers.append('Set-Cookie', 'c=2');
    expect(headerPairs(headers)).toEqual([
      ['x-thing', 'a'],
      ['set-cookie', 'a=1, b'],
      ['set-cookie', 'c=2'],
    ]);
  });
});

/** A fetch that answers `response`, recording what it was asked. */
function upstream(
  response: () => Response,
  calls: { url: string; init: RequestInit | undefined }[] = [],
): typeof fetch {
  return (async (input: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return response();
  }) as typeof fetch;
}

describe('forward', () => {
  it('passes the target status, address and headers on, with its body', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const response = await forward(
      {
        url: 'https://example.com/',
        method: 'GET',
        headers: { accept: 'text/html' },
      },
      upstream(
        () =>
          new Response('<p>hi</p>', {
            status: 404,
            headers: { 'Content-Type': 'text/html' },
          }),
        calls,
      ),
    );
    expect(calls[0]?.init).toMatchObject({
      method: 'GET',
      redirect: 'manual',
      headers: { accept: 'text/html', 'user-agent': USER_AGENT },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/octet-stream',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('upstream-status')).toBe('404');
    expect(response.headers.get('upstream-url')).toBe('https://example.com/');
    expect(
      JSON.parse(
        decodeURIComponent(response.headers.get('upstream-headers') ?? ''),
      ),
    ).toEqual([['content-type', 'text/html']]);
    expect(await response.text()).toBe('<p>hi</p>');
  });

  it('passes a redirect on instead of following it', async () => {
    const response = await forward(
      { url: 'https://example.com/', method: 'GET', headers: {} },
      upstream(
        () =>
          new Response(null, {
            status: 301,
            headers: { Location: 'https://www.example.com/' },
          }),
      ),
    );
    expect(response.headers.get('upstream-status')).toBe('301');
    expect(response.headers.get('upstream-headers')).toContain('location');
  });

  it('sends no body for a HEAD', async () => {
    const response = await forward(
      { url: 'https://example.com/', method: 'HEAD', headers: {} },
      upstream(() => new Response('ignored')),
    );
    expect(response.body).toBeNull();
  });

  it(`cuts the body off at ${MAX_BODY_BYTES} bytes`, async () => {
    const response = await forward(
      { url: 'https://example.com/', method: 'GET', headers: {} },
      upstream(() => new Response(new Uint8Array(MAX_BODY_BYTES + 10))),
    );
    expect((await response.arrayBuffer()).byteLength).toBe(MAX_BODY_BYTES);
  });

  it('throws when the target does not answer', async () => {
    const failure = forward(
      { url: 'https://example.com/', method: 'GET', headers: {} },
      (() => Promise.reject(new TypeError('refused'))) as typeof fetch,
    );
    await expect(failure).rejects.toBeInstanceOf(UnreachableError);
    await expect(failure).rejects.toThrow('example.com did not answer.');
  });
});
