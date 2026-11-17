import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';
import { Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';

import { ALLOWED_PORTS, ScanRefusedError } from './scannable.js';
import type { TransformCallback } from 'node:stream';
import type { IncomingMessage } from 'node:http';

/** Matches an IPv4-mapped or NAT64 IPv6 address that spells the IPv4 in dots. */
const MAPPED_DOTTED_V4 = /^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/u;

/** Matches an IPv4-mapped or NAT64 IPv6 address that spells the IPv4 in two hex groups. */
const MAPPED_HEX_V4 = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u;

/**
 * The scan server fetches whatever address a visitor types, from inside the
 * container. This file keeps those fetches on the public internet: it refuses
 * private, loopback, link-local (the cloud metadata address included),
 * carrier-grade NAT, multicast and other reserved addresses, checked on the
 * address a socket is actually opened to (so a name that resolves to a private
 * address, or is changed between a check and a connection, gets no further),
 * on every redirect hop, and it caps the size of a body and the time spent.
 */

/** The user agent sent with every request, so site owners can tell what called. */
export const USER_AGENT =
  'Mozilla/5.0 (compatible; plumbline/1.0; +https://plumbline.apps.mrida.ng)';

/** An IPv4 address from its four octets, so no literal address is written out. */
const v4 = (...octets: number[]): string => octets.join('.');

/** An IPv6 address from its groups; an empty group is a `::` half. */
const v6 = (...groups: string[]): string => groups.join(':');

/** The IPv4 ranges that are not the public internet, as `address/prefix`. */
const RESERVED_V4: readonly (readonly [string, number])[] = [
  [v4(0, 0, 0, 0), 8],
  [v4(10, 0, 0, 0), 8],
  [v4(100, 64, 0, 0), 10],
  [v4(127, 0, 0, 0), 8],
  [v4(169, 254, 0, 0), 16],
  [v4(172, 16, 0, 0), 12],
  [v4(192, 0, 0, 0), 24],
  [v4(192, 0, 2, 0), 24],
  [v4(192, 88, 99, 0), 24],
  [v4(192, 168, 0, 0), 16],
  [v4(198, 18, 0, 0), 15],
  [v4(198, 51, 100, 0), 24],
  [v4(203, 0, 113, 0), 24],
  [v4(224, 0, 0, 0), 4],
  [v4(240, 0, 0, 0), 4],
];

/** The IPv6 ranges that are not the public internet, as `address/prefix`. */
const RESERVED_V6: readonly (readonly [string, number])[] = [
  [v6('', '', ''), 96],
  [v6('64', 'ff9b', '1', '', ''), 48],
  [v6('100', '', ''), 64],
  [v6('2001', '', ''), 32],
  [v6('2001', '2', '', ''), 48],
  [v6('2001', 'db8', '', ''), 32],
  [v6('2002', '', ''), 16],
  [v6('fc00', '', ''), 7],
  [v6('fe80', '', ''), 10],
  [v6('fec0', '', ''), 10],
  [v6('ff00', '', ''), 8],
];

const reserved = new BlockList();
// eslint-disable-next-line functional/no-loop-statements -- fills the block list, one addSubnet call for each range
for (const [address, prefix] of RESERVED_V4) {
  reserved.addSubnet(address, prefix, 'ipv4');
}
// eslint-disable-next-line functional/no-loop-statements -- fills the block list, one addSubnet call for each range
for (const [address, prefix] of RESERVED_V6) {
  reserved.addSubnet(address, prefix, 'ipv6');
}

/** The IPv4 address inside an IPv4-mapped or NAT64 IPv6 address, if there is one. */
function embeddedV4(ip: string): string | undefined {
  const lower = ip.toLowerCase();
  const dotted = MAPPED_DOTTED_V4.exec(lower);
  if (dotted) {
    return dotted[1];
  }
  const hex = MAPPED_HEX_V4.exec(lower);
  if (hex) {
    const high = Number.parseInt(hex[1] ?? '0', 16);
    const low = Number.parseInt(hex[2] ?? '0', 16);

    return `${Math.trunc(high / 256)}.${high % 256}.${Math.trunc(low / 256)}.${low % 256}`;
  }
  return undefined;
}

/**
 * Whether `ip` is an address on the public internet. Anything that is not an
 * IP address, and every private, loopback, link-local, carrier-grade NAT,
 * multicast or otherwise reserved address (IPv4-mapped IPv6 included), is not.
 */
export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 0) {
    return false;
  }
  if (family === 6) {
    const inner = embeddedV4(ip);
    if (inner !== undefined) {
      return isPublicAddress(inner);
    }
    return !reserved.check(ip, 'ipv6');
  }
  return !reserved.check(ip, 'ipv4');
}

/** What the guard may be told to relax or tighten. */
export interface GuardOptions {
  /** Allow private and loopback addresses and any port; for tests against a local server only. */
  readonly allowPrivate?: boolean;
  /** The most body bytes read (after decompression). */
  readonly maxBytes?: number;
  /** How long one request may take, in milliseconds. */
  readonly timeoutMs?: number;
  /** The most redirects followed. */
  readonly maxRedirects?: number;
}

/** A request the guard refused, or that went wrong on the way. */
export class GuardError extends ScanRefusedError {
  public constructor(message: string) {
    super(message);
    this.name = 'GuardError';
  }
}

/** The host of a URL without the brackets around an IPv6 address. */
function bareHost(url: URL): string {
  return url.hostname.replaceAll(/^\[|\]$/gu, '');
}

/**
 * Throws unless `url` may be fetched: http(s) only, the default port or one of
 * 80, 443, 8080 and 8443, and a host that is not a private IP address. (A name
 * is checked when it is resolved, see {@link guardedLookup}.).
 */
export function assertAllowed(url: URL, options: GuardOptions = {}): void {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new GuardError(
      `Only http and https can be fetched, not ${url.protocol}`,
    );
  }
  if (options.allowPrivate) {
    return;
  }
  if (url.port !== '' && !ALLOWED_PORTS.has(Number(url.port))) {
    throw new GuardError(`Port ${url.port} cannot be fetched`);
  }
  if (url.username !== '' || url.password !== '') {
    throw new GuardError(
      'An address with a user name or password cannot be fetched',
    );
  }
  const host = bareHost(url);
  if (isIP(host) !== 0 && !isPublicAddress(host)) {
    throw new GuardError(`${host} is not a public address`);
  }
}

/** The `dns.lookup` signature the guard wraps. */
type Lookup = typeof dns.lookup;

/**
 * A `lookup` for a socket that resolves the name and refuses it when any
 * address it resolves to is not public. Node connects to the address handed
 * back, so this is the check on the address actually connected to.
 */
export function guardedLookup(
  lookup: Lookup,
  options: GuardOptions = {},
): Lookup {
  const wrapped = (
    hostname: string,
    optionsOrHandler: unknown,
    maybeHandler?: unknown,
  ): void => {
    const respond = (
      typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler
    ) as (
      failure: Error | null,
      address?: string | dns.LookupAddress[],
      family?: number,
    ) => void;
    const given =
      typeof optionsOrHandler === 'object' && optionsOrHandler !== null
        ? optionsOrHandler
        : undefined;
    // With no options given, the defaults stand.
    const lookupOptions: dns.LookupOptions =
      given ??
      (typeof optionsOrHandler === 'number'
        ? { family: optionsOrHandler }
        : {});
    lookup(hostname, { ...lookupOptions, all: true }, (failure, addresses) => {
      if (failure) {
        respond(failure);
        return;
      }
      const list = addresses;
      const refused = options.allowPrivate
        ? undefined
        : list.find((entry) => !isPublicAddress(entry.address));
      if (refused) {
        respond(
          new GuardError(
            `${hostname} resolves to ${refused.address}, which is not a public address`,
          ),
        );
        return;
      }
      if (lookupOptions.all) {
        respond(null, list);
        return;
      }
      const first = list[0];
      if (!first) {
        respond(new GuardError(`${hostname} did not resolve`));
        return;
      }
      respond(null, first.address, first.family);
    });
  };
  return wrapped as unknown as Lookup;
}

/** The forms of request headers `fetch` accepts. */
type HeadersInit = ConstructorParameters<typeof Headers>[0];

/** The forms of request body `fetch` accepts. */
type BodyInit = NonNullable<ConstructorParameters<typeof Response>[0]>;

/** The request headers as a plain object, from any of the forms `fetch` accepts. */
function headersOf(init: HeadersInit | undefined) {
  return Object.fromEntries(new Headers(init).entries());
}

/** The body of a request as bytes, for the forms the checks use. */
function bodyOf(body: BodyInit | null | undefined): Buffer | undefined {
  if (body === null || body === undefined) {
    return undefined;
  }
  if (typeof body === 'string') {
    return Buffer.from(body);
  }
  if (body instanceof URLSearchParams) {
    return Buffer.from(body.toString());
  }
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }
  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  }
  throw new GuardError('That request body cannot be sent');
}

/** The decoder for a `Content-Encoding`, or none when the body is not encoded. */
function decoderFor(encoding: string | undefined): Transform | undefined {
  switch ((encoding ?? '').trim().toLowerCase()) {
    case 'gzip':
    case 'x-gzip': {
      return zlib.createGunzip();
    }
    case 'deflate': {
      return zlib.createInflate();
    }
    case 'br': {
      return zlib.createBrotliDecompress();
    }
    default: {
      return undefined;
    }
  }
}

/** A stream stage that fails once more than `max` bytes have gone through. */
function capBytes(max: number): Transform {
  // eslint-disable-next-line functional/no-let -- the stream stage counts the bytes that went through it
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding: string, done: TransformCallback) {
      seen += chunk.length;
      if (seen > max) {
        done(new GuardError(`The response is larger than ${max} bytes`));
        return;
      }
      done(null, chunk);
    },
  });
}

/** Reads a response's body to bytes, decoded and capped. */
async function readBody(
  response: IncomingMessage,
  max: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _encoding, done) {
      // eslint-disable-next-line functional/immutable-data -- the body is collected as it streams in
      chunks.push(chunk);
      done();
    },
  });
  const decoder = decoderFor(response.headers['content-encoding']);
  await (decoder
    ? pipeline(response, decoder, capBytes(max), sink)
    : pipeline(response, capBytes(max), sink));
  return Buffer.concat(chunks);
}

/** The response headers, one entry per header line, as a `Headers`. */
function responseHeaders(response: IncomingMessage): Headers {
  // A header the Fetch API cannot hold is left out.
  return new Headers(
    Array.from(
      { length: Math.floor(response.rawHeaders.length / 2) },
      (_, line): [string, string] => [
        response.rawHeaders[line * 2] ?? '',
        response.rawHeaders[line * 2 + 1] ?? '',
      ],
    ).flatMap((pair): [string, string][] => {
      try {
        return new Headers([pair]).has(pair[0]) ? [pair] : [];
      } catch {
        return [];
      }
    }),
  );
}

/** Whether a status carries no body. */
function bodyless(status: number): boolean {
  return [101, 204, 205, 304].includes(status);
}

/** Sends one request, without following a redirect. */
async function once(
  url: URL,
  method: string,
  headers: Record<string, string>,
  body: Buffer | undefined,
  signal: AbortSignal,
  lookup: Lookup,
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(
      url,
      { method, headers, signal, lookup },
      resolve,
    );
    request.on('error', reject);
    request.end(body);
  }).then((response) => response as IncomingMessage);
}

/** The status codes that redirect. */
const REDIRECTS: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

/**
 * A `fetch` that stays on the public internet (see the top of this file).
 * `redirect` is honoured: `follow` (the default) follows up to
 * `maxRedirects` hops, checking each one; `manual` returns the redirect itself;
 * `error` throws on one. The body is decoded and read in full, so a response
 * is returned only once it is complete and within `maxBytes`.
 */
export function guardedFetch(options: GuardOptions = {}): typeof fetch {
  const maxBytes = options.maxBytes ?? 10 * 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxRedirects = options.maxRedirects ?? 10;
  const lookup = guardedLookup(dns.lookup, options);
  return async (input, init = {}) => {
    const first = new URL(input instanceof Request ? input.url : String(input));
    const method = (init.method ?? 'GET').toUpperCase();
    const redirect = init.redirect ?? 'follow';
    const signal = AbortSignal.any([
      AbortSignal.timeout(timeoutMs),
      ...(init.signal ? [init.signal] : []),
    ]);
    const follow = async (
      current: URL,
      hops: number,
      verb: string,
      headers: Record<string, string>,
      body: Buffer | null,
      redirected: boolean,
    ): Promise<Response> => {
      assertAllowed(current, options);
      const sent = await once(
        current,
        verb,
        headers,
        body ?? undefined,
        signal,
        lookup,
      );
      const status = sent.statusCode ?? 0;
      const location = sent.headers.location;
      if (REDIRECTS.has(status) && location && redirect !== 'manual') {
        sent.resume();
        if (redirect === 'error') {
          throw new GuardError(`${current.href} redirected`);
        }
        if (hops >= maxRedirects) {
          throw new GuardError('Too many redirects');
        }
        const next = new URL(location, current);
        const asGet =
          status === 303 ||
          ((status === 301 || status === 302) && verb === 'POST');
        const getVerb = verb === 'HEAD' ? 'HEAD' : 'GET';
        return follow(
          next,
          hops + 1,
          asGet ? getVerb : verb,
          // Credentials stay with the site they were meant for.
          next.origin === current.origin
            ? headers
            : Object.fromEntries(
                Object.entries(headers).filter(
                  ([name]) => name !== 'authorization' && name !== 'cookie',
                ),
              ),
          asGet ? null : body,
          true,
        );
      }
      const content =
        verb === 'HEAD' || bodyless(status)
          ? (sent.resume(), Buffer.alloc(0))
          : await readBody(sent, maxBytes);
      const response = new Response(
        verb === 'HEAD' || bodyless(status) ? null : new Uint8Array(content),
        {
          status,
          statusText: sent.statusMessage ?? '',
          headers: responseHeaders(sent),
        },
      );
      // eslint-disable-next-line functional/immutable-data -- Response.url is read-only; it is set on the response built here
      Object.defineProperty(response, 'url', { value: current.href });
      // eslint-disable-next-line functional/immutable-data -- Response.redirected is read-only; it is set on the response built here
      Object.defineProperty(response, 'redirected', { value: redirected });
      return response;
    };
    return follow(
      first,
      0,
      method,
      {
        accept: '*/*',
        'accept-encoding': 'gzip, deflate, br',
        'user-agent': USER_AGENT,
        ...headersOf(init.headers),
      },
      bodyOf(init.body) ?? null,
      false,
    );
  };
}

/** How many scans have the guard installed. */
// eslint-disable-next-line functional/no-let -- how many scans have the guard installed
let installed = 0;
// eslint-disable-next-line functional/no-let -- what the guard replaced, to put back
let saved: { fetch: typeof fetch; lookup: Lookup } | null = null;

/**
 * Puts the guard under every fetch and every name lookup in the process for as
 * long as it is installed: `globalThis.fetch` becomes {@link guardedFetch}, and
 * `dns.lookup`, which sockets use to resolve the name they connect to, refuses
 * names that resolve to a non-public address. The checks open their own sockets
 * (TLS, mail), so this is what keeps them off the internal network too.
 * Returns the function that removes it; the guard stays until every scan that
 * installed it has finished.
 */
export function installGuard(options: GuardOptions = {}): () => void {
  if (installed === 0) {
    saved = { fetch: globalThis.fetch, lookup: dns.lookup };
    // eslint-disable-next-line functional/immutable-data -- the guard is put under the global fetch for the scan
    globalThis.fetch = guardedFetch(options);
    // eslint-disable-next-line functional/immutable-data -- the guard is put under the name lookup sockets use
    (dns as { lookup: Lookup }).lookup = guardedLookup(saved.lookup, options);
  }
  installed += 1;
  // eslint-disable-next-line functional/no-let -- makes the removal run once
  let removed = false;
  return () => {
    if (removed) {
      return;
    }
    removed = true;
    installed -= 1;
    if (installed === 0 && saved) {
      // eslint-disable-next-line functional/immutable-data -- puts back the global fetch the guard replaced
      globalThis.fetch = saved.fetch;
      // eslint-disable-next-line functional/immutable-data -- puts back the name lookup the guard replaced
      (dns as { lookup: Lookup }).lookup = saved.lookup;
      saved = null;
    }
  };
}
