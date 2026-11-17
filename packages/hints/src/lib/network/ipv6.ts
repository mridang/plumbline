/**
 * IPv6 checks ported from Internet.nl (checks/tasks/ipv6.py): name server
 * and web server addresses, reachability and whether the site looks the same
 * over IPv6 and IPv4.
 */
import { connect } from '#net';
import { request } from '#http';
import { request as httpsRequest } from '#https';
import {
  findNameservers,
  ipv4Addresses,
  ipv6Addresses,
} from './dns-utility.js';
import type { Zone } from './dns-utility.js';

/** Seconds Internet.nl waits for a connection; we use the same 4 seconds. */
const CONNECT_TIMEOUT_MS = 4000;
/** Internet.nl compares at most this many bytes of each response. */
const MAX_BODY = 500_000;
/** Largest content difference (percent) that still counts as identical. */
const SIMHASH_MAX = 10;

/** Tries a TCP connection and resolves true when it was accepted. */
export type ConnectFn = (
  ip: string,
  port: number,
  timeoutMs: number,
) => Promise<boolean>;

/** A fetched page, as far as the comparison needs it. */
export interface WebResponse {
  status: number;
  body: string;
}

/** Fetches `/` from one specific IP address while sending the host name. */
export type WebGetFn = (
  host: string,
  ip: string,
  port: number,
  https: boolean,
) => Promise<WebResponse | null>;

/** Real TCP connect. */
export const tcpConnect: ConnectFn = async (ip, port, timeoutMs) =>
  new Promise((resolve) => {
    const socket = connect({ host: ip, port });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });

/** Real HTTP(S) GET to a fixed IP with the host name as Host and SNI. */
export const httpGetByIp: WebGetFn = async (host, ip, port, https) =>
  new Promise((resolve) => {
    const make = https ? httpsRequest : request;
    const req = make(
      {
        host: ip,
        port,
        path: '/',
        method: 'GET',
        headers: { host, 'user-agent': 'plumbline', accept: '*/*' },
        servername: host,
        timeout: CONNECT_TIMEOUT_MS * 2,
      },
      (res) => {
        const chunks: Buffer[] = [];
        // eslint-disable-next-line functional/no-let -- running byte count of the streamed response
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          // eslint-disable-next-line functional/immutable-data -- accumulates the streamed response chunks
          chunks.push(c);
          if (size >= MAX_BODY) {
            res.destroy();
          }
        });
        const finish = () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks)
              .subarray(0, MAX_BODY)
              .toString('latin1'),
          });
        res.on('end', finish);
        res.on('close', finish);
        res.on('error', finish);
      },
    );
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
    req.end();
  });

/** The network clients the hints use; tests assign fakes. */
export const network = {
  connect: tcpConnect,
  get: httpGetByIp,
};

export interface NsAddresses {
  name: string;
  v4: string[];
  v6: string[];
}

/** Resolves A and AAAA for each name server. */
export async function nameserverAddresses(
  names: string[],
): Promise<NsAddresses[]> {
  return names.reduce<Promise<NsAddresses[]>>(
    async (done, name) => [
      ...(await done),
      {
        name,
        v4: await ipv4Addresses(name),
        v6: await ipv6Addresses(name),
      },
    ],
    Promise.resolve([]),
  );
}

/** The zone's name servers with their addresses. */
export async function zoneNameservers(
  host: string,
): Promise<{ zone: Zone; servers: NsAddresses[] }> {
  const zone = await findNameservers(host);
  return { zone, servers: await nameserverAddresses(zone.nameservers) };
}

/** One line per name server with its addresses, as evidence. */
export function nameserverLines(servers: NsAddresses[]): string {
  return servers
    .map(
      ({ name, v4, v6 }) =>
        `${name}. A ${v4.join(', ') || 'none'}; AAAA ${v6.join(', ') || 'none'}`,
    )
    .join('\n');
}

/** `none`: no name server has IPv6; `one`: just one; `good`: two or more. */
export type NsAaaaVerdict = 'none' | 'one' | 'good';

/** Internet.nl `ns_aaaa`: at least two name servers need an IPv6 address. */
export function judgeNsAaaa(servers: NsAddresses[]): NsAaaaVerdict {
  const withV6 = servers.filter((s) => s.v6.length > 0).length;
  if (withV6 === 0) {
    return 'none';
  }
  return withV6 === 1 ? 'one' : 'good';
}

/** Name servers (with their IPv6 addresses) that cannot be reached on port 53. */
export async function unreachableNameservers(
  servers: NsAddresses[],
): Promise<{ name: string; ips: string[] }[]> {
  return servers.reduce<Promise<{ name: string; ips: string[] }[]>>(
    async (done, server) => {
      const bad = await done;
      // Internet.nl sends a DNS query; DNS servers must also answer on TCP
      // (RFC 7766), so a TCP connect to port 53 tells the same story.
      const failed = await server.v6.reduce<Promise<string[]>>(
        async (doneIps, ip) => {
          const failedIps = await doneIps;
          return (await network.connect(ip, 53, CONNECT_TIMEOUT_MS))
            ? failedIps
            : [...failedIps, ip];
        },
        Promise.resolve([]),
      );
      return failed.length > 0
        ? [...bad, { name: server.name, ips: failed }]
        : bad;
    },
    Promise.resolve([]),
  );
}

/**
 * IPv6 addresses of the web server that accept no connection on port 80 nor
 * 443 (Internet.nl `web_reach`).
 */
export async function unreachableWebAddresses(v6: string[]): Promise<string[]> {
  return v6.reduce<Promise<string[]>>(async (done, ip) => {
    const bad = await done;
    const ok =
      (await network.connect(ip, 80, CONNECT_TIMEOUT_MS)) ||
      (await network.connect(ip, 443, CONNECT_TIMEOUT_MS));
    return ok ? bad : [...bad, ip];
  }, Promise.resolve([]));
}

/** Removes the parts of a page that legitimately differ between requests. */
export function stripIrrelevantHtml(html: string): string {
  return stripNonceAttributes(html).replaceAll(
    /<input\b[^>]*name\s*=\s*["']?__VIEWSTATE["']?[^>]*>/giu,
    '',
  );
}

/** The value of an HTML attribute: quoted, or a run up to whitespace or `>`. */
const ATTRIBUTE_VALUE = String.raw`(?:"[^"]*"|'[^']*'|[^\s>]+)`;

/** A `nonce` attribute with its leading whitespace, in any open tag. */
const NONCE_ATTRIBUTE = String.raw`\s+nonce\s*=\s*${ATTRIBUTE_VALUE}`;

/** The open tag of a script or style up to where its `nonce` attribute starts. */
const TAG_BEFORE_NONCE = new RegExp(
  String.raw`(<(?:script|style)\b(?:[^\s>]|\s(?!\s*nonce\s*=))*)${NONCE_ATTRIBUTE}`,
  'giu',
);

/** Removes the `nonce` attribute from `<script>` and `<style>` tags. */
function stripNonceAttributes(html: string): string {
  return html.replaceAll(TAG_BEFORE_NONCE, '$1');
}

/**
 * Python's `SequenceMatcher.quick_ratio`: an upper bound of the similarity
 * of two strings computed from their character counts (0..1).
 */
export function quickRatio(a: string, b: string): number {
  if (a.length + b.length === 0) {
    return 1;
  }
  const available = Map.groupBy(b, (ch) => ch);
  const matches = [...Map.groupBy(a, (ch) => ch)].reduce(
    (sum, [ch, list]) =>
      sum + Math.min(list.length, available.get(ch)?.length ?? 0),
    0,
  );
  return (2 * matches) / (a.length + b.length);
}

/** The outcome of the IPv6 versus IPv4 comparison. */
export type SameContentVerdict =
  'good' | 'bad' | 'notice' | 'notice-status-code' | 'skip';

/** Fetches `/` on ports 80 and 443 over one family; the last success wins. */
async function fetchFamily(
  host: string,
  ips: string[],
): Promise<{ ports: Set<number>; response: WebResponse | null }> {
  const firstResponse = async (
    https: boolean,
    rest: string[],
  ): Promise<WebResponse | null> => {
    const ip = rest.at(0);
    if (ip === undefined) {
      return null;
    }
    return (
      (await network.get(host, ip, https ? 443 : 80, https)) ??
      firstResponse(https, rest.slice(1))
    );
  };
  const on80 = await firstResponse(false, ips);
  const on443 = await firstResponse(true, ips);
  return {
    ports: new Set([80, 443].filter((port) => (port === 443 ? on443 : on80))),
    response: on443 ?? on80,
  };
}

/**
 * Internet.nl `web_ipv46`: compare the site over IPv6 and IPv4. The ports
 * answering, the status code and the HTML (nonces stripped, at most 10% of
 * difference) must match. Returns `skip` when there is no IPv4 or no IPv6
 * address, because nothing can be compared.
 */
export async function compareIpFamilies(
  host: string,
  v4: string[],
  v6: string[],
): Promise<SameContentVerdict> {
  if (v4.length === 0 || v6.length === 0) {
    return 'skip';
  }
  const four = await fetchFamily(host, v4);
  const six = await fetchFamily(host, v6);
  if (!four.response || !six.response) {
    return 'bad';
  }
  const samePorts =
    four.ports.size === six.ports.size &&
    [...four.ports].every((p) => six.ports.has(p));
  if (!samePorts || four.response.status !== six.response.status) {
    return 'bad';
  }
  const distance =
    100 *
    (1 -
      quickRatio(
        stripIrrelevantHtml(four.response.body),
        stripIrrelevantHtml(six.response.body),
      ));
  if (distance <= SIMHASH_MAX) {
    const { status } = six.response;
    return status >= 200 && status <= 400 ? 'good' : 'notice-status-code';
  }
  return 'notice';
}
