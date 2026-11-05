import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import dns from 'node:dns';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import zlib from 'node:zlib';
import {
  GuardError,
  assertAllowed,
  guardedFetch,
  installGuard,
  isPublicAddress,
} from '../../src/engine/guard.js';

describe('isPublicAddress', () => {
  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111'])(
    'accepts the public address %s',
    (ip) => {
      expect(isPublicAddress(ip)).toBe(true);
    },
  );

  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.5.5',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '198.18.0.1',
    '::',
    '::1',
    'fe80::1',
    'fc00::1',
    'fd12:3456::1',
    'ff02::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:169.254.169.254',
    '64:ff9b::a00:1',
  ])('refuses the address %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it('refuses what is not an address', () => {
    expect(isPublicAddress('example.com')).toBe(false);
    expect(isPublicAddress('')).toBe(false);
  });

  it('accepts a public address inside an IPv4-mapped one', () => {
    expect(isPublicAddress('::ffff:8.8.8.8')).toBe(true);
  });
});

describe('assertAllowed', () => {
  it.each([
    'https://example.com/',
    'http://example.com/',
    'https://example.com:8443/',
    'http://example.com:8080/',
    'https://93.184.216.34/',
  ])('allows %s', (url) => {
    expect(() => assertAllowed(new URL(url))).not.toThrow();
  });

  it.each([
    ['ftp://example.com/', 'Only http and https'],
    ['file:///etc/passwd', 'Only http and https'],
    ['https://example.com:22/', 'Port 22'],
    ['http://example.com:6379/', 'Port 6379'],
    ['https://user:pass@example.com/', 'user name or password'],
    ['http://127.0.0.1/', 'not a public address'],
    ['http://169.254.169.254/latest/meta-data/', 'not a public address'],
    ['http://[::1]/', 'not a public address'],
    ['http://[::ffff:10.0.0.1]/', 'not a public address'],
    ['http://2130706433/', 'not a public address'],
    ['http://0x7f.1/', 'not a public address'],
  ])('refuses %s', (url, reason) => {
    expect(() => assertAllowed(new URL(url))).toThrow(GuardError);
    expect(() => assertAllowed(new URL(url))).toThrow(reason);
  });

  it('lets a local server and any port through when told to', () => {
    expect(() =>
      assertAllowed(new URL('http://127.0.0.1:5555/'), { allowPrivate: true }),
    ).not.toThrow();
  });
});

describe('guardedFetch', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const path = req.url ?? '/';
      if (path === '/loop') {
        res.writeHead(302, { location: '/loop' });
        res.end();
      } else if (path === '/to-ok') {
        res.writeHead(301, { location: '/ok' });
        res.end();
      } else if (path === '/gzip') {
        res.writeHead(200, {
          'content-type': 'text/plain',
          'content-encoding': 'gzip',
        });
        res.end(zlib.gzipSync('squeezed'));
      } else if (path === '/big') {
        res.writeHead(200);
        res.end(Buffer.alloc(5000, 97));
      } else if (path === '/slow') {
        setTimeout(() => res.end('late'), 2000);
      } else if (path === '/none') {
        res.writeHead(204);
        res.end();
      } else if (path === '/cookies') {
        res.writeHead(200, { 'set-cookie': ['a=1', 'b=2'] });
        res.end('ok');
      } else if (path === '/echo') {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          res.writeHead(200, { 'x-method': req.method ?? '' });
          res.end(Buffer.concat(chunks));
        });
      } else {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('ok');
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve()),
    );
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(
    () => new Promise((resolve) => server.close(() => resolve(undefined))),
  );

  const local = guardedFetch({ allowPrivate: true, timeoutMs: 500 });

  it('refuses a local address by default', async () => {
    await expect(guardedFetch()('http://127.0.0.1:8080/')).rejects.toThrow(
      'not a public address',
    );
    await expect(guardedFetch()(`${base}/ok`)).rejects.toThrow(GuardError);
  });

  it('refuses a name that resolves to a private address', async () => {
    await expect(guardedFetch()('http://localhost:8080/')).rejects.toThrow(
      /not a public address/,
    );
  });

  it('returns the status, the body and the final address', async () => {
    const response = await local(`${base}/ok`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
    expect(response.url).toBe(`${base}/ok`);
    expect(response.redirected).toBe(false);
  });

  it('follows a redirect and says so', async () => {
    const response = await local(`${base}/to-ok`);
    expect(response.url).toBe(`${base}/ok`);
    expect(response.redirected).toBe(true);
  });

  it('returns the redirect itself when asked to', async () => {
    const response = await local(`${base}/to-ok`, { redirect: 'manual' });
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('/ok');
  });

  it('refuses to follow a redirect when asked to', async () => {
    await expect(local(`${base}/to-ok`, { redirect: 'error' })).rejects.toThrow(
      'redirected',
    );
  });

  it('gives up after too many redirects', async () => {
    await expect(local(`${base}/loop`)).rejects.toThrow('Too many redirects');
  });

  it('decodes a compressed body and keeps the header', async () => {
    const response = await local(`${base}/gzip`);
    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(await response.text()).toBe('squeezed');
  });

  it('refuses a body larger than the cap', async () => {
    await expect(
      guardedFetch({ allowPrivate: true, maxBytes: 1000 })(`${base}/big`),
    ).rejects.toThrow('larger than 1000 bytes');
  });

  it('gives up on a server that is too slow', async () => {
    await expect(local(`${base}/slow`)).rejects.toThrow();
  });

  it('returns no body for a 204 and for HEAD', async () => {
    expect((await local(`${base}/none`)).status).toBe(204);
    const head = await local(`${base}/ok`, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });

  it('keeps each Set-Cookie line', async () => {
    const response = await local(`${base}/cookies`);
    expect(response.headers.getSetCookie()).toEqual(['a=1', 'b=2']);
  });

  it('sends the method and body it is given', async () => {
    const response = await local(`${base}/echo`, {
      method: 'POST',
      body: 'hello',
    });
    expect(response.headers.get('x-method')).toBe('POST');
    expect(await response.text()).toBe('hello');
  });
});

describe('installGuard', () => {
  it('guards fetch and name lookups while installed, and puts them back after', () => {
    const fetchBefore = globalThis.fetch;
    const lookupBefore = dns.lookup;
    const first = installGuard();
    const second = installGuard();
    expect(globalThis.fetch).not.toBe(fetchBefore);
    expect(dns.lookup).not.toBe(lookupBefore);
    first();
    first();
    expect(globalThis.fetch).not.toBe(fetchBefore);
    second();
    expect(globalThis.fetch).toBe(fetchBefore);
    expect(dns.lookup).toBe(lookupBefore);
  });

  it('refuses a socket to a name that resolves to a private address', async () => {
    const remove = installGuard();
    try {
      await expect(
        new Promise((resolve, reject) => {
          dns.lookup('localhost', (error, address) =>
            error ? reject(error) : resolve(address),
          );
        }),
      ).rejects.toThrow('not a public address');
    } finally {
      remove();
    }
  });
});
