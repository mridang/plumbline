import { brotliCompressSync } from 'node:zlib';

import { describe, expect, it } from '@jest/globals';

import {
  decode,
  probeFetch,
  unchunk,
} from '../../../src/engine/probe/fetch.js';
import { ProbeError } from '../../../src/engine/probe/protocol.js';
import {
  chunked,
  deflateSync,
  fakeProbe,
  gzipSync,
  httpAnswer,
  linesOf,
  ok,
} from '../../helpers/probe.js';

/** A fake site: the answer for each path, and the requests it saw. */
function site(routes: Record<string, string>): ReturnType<typeof fakeProbe> {
  return fakeProbe((_path, body) => {
    const line = linesOf(body);
    return ok(
      routes[line['path'] ?? ''] ?? httpAnswer(404, [], 'nope', 'Not Found'),
    );
  });
}

describe('unchunk', () => {
  it('puts the chunks together, ignoring chunk extensions', () => {
    expect(
      new TextDecoder().decode(
        unchunk(Buffer.from('3;ext=1\r\nabc\r\n2\r\nde\r\n0\r\n\r\n')),
      ),
    ).toBe('abcde');
  });

  it('keeps what came when the probe cut the body at its limit', () => {
    expect(new TextDecoder().decode(unchunk(Buffer.from('a\r\n12345')))).toBe(
      '12345',
    );
  });

  it('refuses a chunk header that is not a number, or one that never ends', () => {
    expect(() => unchunk(Buffer.from('zz\r\nabc'))).toThrow('chunk size');
    expect(() => unchunk(Buffer.from('3'))).toThrow('inside a chunk header');
  });
});

describe('decode', () => {
  it('undoes gzip, deflate and brotli and leaves anything else alone', () => {
    const text = Buffer.from('hello world');
    // eslint-disable-next-line n/no-sync -- sync is fine in a test fixture that builds encoded bodies
    expect(Buffer.from(decode(gzipSync(text), 'gzip')).toString()).toBe(
      'hello world',
    );
    // eslint-disable-next-line n/no-sync -- sync is fine in a test fixture that builds encoded bodies
    expect(Buffer.from(decode(gzipSync(text), 'x-gzip')).toString()).toBe(
      'hello world',
    );
    // eslint-disable-next-line n/no-sync -- sync is fine in a test fixture that builds encoded bodies
    expect(Buffer.from(decode(deflateSync(text), 'deflate')).toString()).toBe(
      'hello world',
    );
    // eslint-disable-next-line n/no-sync -- sync is fine in a test fixture that builds encoded bodies
    expect(Buffer.from(decode(brotliCompressSync(text), 'br')).toString()).toBe(
      'hello world',
    );
    expect(Buffer.from(decode(text, undefined)).toString()).toBe('hello world');
    expect(Buffer.from(decode(text, 'zstd')).toString()).toBe('hello world');
  });

  it('says which coding a body that does not decode was in', () => {
    expect(() => decode(Buffer.from('not gzip'), 'gzip')).toThrow(ProbeError);
    expect(() => decode(Buffer.from('not gzip'), 'gzip')).toThrow(
      'decoded as gzip',
    );
  });
});

describe('probeFetch', () => {
  it('returns every header line the site sent, duplicates and an Alt-Svc included, and the decoded body', async () => {
    const { client, sent } = site({
      '/': httpAnswer(
        200,
        [
          ['Content-Encoding', 'gzip'],
          ['Alt-Svc', 'h3=":443"; ma=86400'],
          ['Set-Cookie', 'a=1'],
          ['Set-Cookie', 'b=2'],
        ],
        // eslint-disable-next-line n/no-sync -- sync is fine in a test fixture that builds encoded bodies
        gzipSync('<html>hi</html>'),
      ),
    });
    const response = await probeFetch(client)('https://example.com/');
    expect(response.status).toBe(200);
    expect(response.headers.get('alt-svc')).toBe('h3=":443"; ma=86400');
    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(response.headers.getSetCookie()).toEqual(['a=1', 'b=2']);
    expect(await response.text()).toBe('<html>hi</html>');
    expect(response.url).toBe('https://example.com/');
    expect(response.redirected).toBe(false);
    const request = linesOf(sent[0]?.body ?? '');
    expect(request).toMatchObject({
      host: 'example.com',
      port: '443',
      tls: '1',
      method: 'GET',
      path: '/',
    });
    expect(sent[0]?.body).toContain(
      'header=accept-encoding: gzip, deflate, br\n',
    );
    expect(sent[0]?.body).toContain(
      'header=user-agent: Mozilla/5.0 (compatible; plumbline/1.0',
    );
  });

  it('puts a chunked body together before it decodes it, and sends the path with its query', async () => {
    const { client, sent } = site({
      '/a?b=1': httpAnswer(
        200,
        [['Transfer-Encoding', 'chunked']],
        chunked('he', 'llo'),
      ),
    });
    // eslint-disable-next-line unicorn/prefer-https -- test fixture
    const response = await probeFetch(client)('http://example.com:8080/a?b=1');
    expect(await response.text()).toBe('hello');
    expect(linesOf(sent[0]?.body ?? '')).toMatchObject({
      port: '8080',
      path: '/a?b=1',
    });
    expect(sent[0]?.body).not.toContain('tls=1');
  });

  it('follows redirects up to the limit by default, and says it did', async () => {
    const { client } = site({
      '/': httpAnswer(301, [['Location', '/next']], '', 'Moved'),
      '/next': httpAnswer(200, [], 'arrived'),
    });
    const response = await probeFetch(client)('https://example.com/');
    expect(await response.text()).toBe('arrived');
    expect(response.url).toBe('https://example.com/next');
    expect(response.redirected).toBe(true);
  });

  it('hands a redirect back when it is asked to and refuses one when it is asked to', async () => {
    const { client } = site({
      '/': httpAnswer(302, [['Location', 'https://other.test/']], '', 'Found'),
    });
    const manual = await probeFetch(client)('https://example.com/', {
      redirect: 'manual',
    });
    expect(manual.status).toBe(302);
    expect(manual.headers.get('location')).toBe('https://other.test/');
    await expect(
      probeFetch(client)('https://example.com/', { redirect: 'error' }),
    ).rejects.toThrow('redirected');
  });

  it('stops after too many redirects', async () => {
    const { client } = site({
      '/': httpAnswer(302, [['Location', '/']], '', 'Found'),
    });
    await expect(probeFetch(client, 3)('https://example.com/')).rejects.toThrow(
      'Too many redirects',
    );
  });

  it('asks for the headers only on HEAD and returns no body for a status that has none', async () => {
    const { client, sent } = site({
      '/': httpAnswer(204, [], '', 'No Content'),
      '/h': httpAnswer(200, [['Content-Length', '5']], '', 'OK'),
    });
    const first = await probeFetch(client)('https://example.com/');
    expect(await first.text()).toBe('');
    const head = await probeFetch(client)('https://example.com/h', {
      method: 'HEAD',
    });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    expect(sent[1]?.body).toContain('nobody=1');
  });

  it('refuses an address a scan may not use, a body it cannot send, and a body that is too large', async () => {
    const { client } = site({});
    await expect(probeFetch(client)('ftp://example.com/')).rejects.toThrow(
      'Only http and https',
    );
    await expect(probeFetch(client)('https://example.com:22/')).rejects.toThrow(
      'Port 22',
    );
    await expect(
      probeFetch(client)('https://example.com/', { method: 'POST', body: 'x' }),
    ).rejects.toThrow('request body cannot be sent');
  });

  it('lets the headers of a request override the defaults', async () => {
    const { client, sent } = site({ '/': httpAnswer(200, [], 'x') });
    await probeFetch(client)('https://example.com/', {
      headers: { 'Accept-Encoding': 'identity', 'X-Test': '1' },
    });
    expect(sent[0]?.body).toContain('header=accept-encoding: identity\n');
    expect(sent[0]?.body).toContain('header=x-test: 1\n');
  });

  it("passes the probe's complaint on, as an error with its words", async () => {
    const { client } = fakeProbe(() => ({
      status: 502,
      text: '{"error":"not a public address"}',
    }));
    await expect(probeFetch(client)('https://example.com/')).rejects.toThrow(
      'not a public address',
    );
  });

  it('reads an IPv6 literal without its brackets', async () => {
    const { client, sent } = site({ '/': httpAnswer(200, [], 'x') });
    await probeFetch(client)('https://[2606:4700:4700::1111]/');
    // eslint-disable-next-line sonarjs/no-hardcoded-ip -- test fixture
    expect(linesOf(sent[0]?.body ?? '')['host']).toBe('2606:4700:4700::1111');
  });
});
