/**
 * IPv6 checks ported from Internet.nl (checks/tasks/ipv6.py): name server
 * and web server addresses, reachability and whether the site looks the same
 * over IPv6 and IPv4.
 */
import { connect as netConnect } from '#net';
import { request as httpRequest } from '#http';
import { request as httpsRequest } from '#https';
import {
  findNameservers,
  ipv4Addresses,
  ipv6Addresses,
  type Zone,
} from './dns-util.js';

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
export const tcpConnect: ConnectFn = (ip, port, timeoutMs) =>
  new Promise((resolve) => {
    const socket = netConnect({ host: ip, port });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });

/** Real HTTP(S) GET to a fixed IP with the host name as Host and SNI. */
export const httpGetByIp: WebGetFn = (host, ip, port, https) =>
  new Promise((resolve) => {
    const make = https ? httpsRequest : httpRequest;
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
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
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
export const network: { connect: ConnectFn; get: WebGetFn } = {
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
  const out: NsAddresses[] = [];
  for (const name of names) {
    out.push({
      name,
      v4: await ipv4Addresses(name),
      v6: await ipv6Addresses(name),
    });
  }
  return out;
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
  return withV6 === 0 ? 'none' : withV6 === 1 ? 'one' : 'good';
}

/** Name servers (with their IPv6 addresses) that cannot be reached on port 53. */
export async function unreachableNameservers(
  servers: NsAddresses[],
): Promise<{ name: string; ips: string[] }[]> {
  const bad: { name: string; ips: string[] }[] = [];
  for (const server of servers) {
    const failed: string[] = [];
    for (const ip of server.v6) {
      // Internet.nl sends a DNS query; DNS servers must also answer on TCP
      // (RFC 7766), so a TCP connect to port 53 tells the same story.
      if (!(await network.connect(ip, 53, CONNECT_TIMEOUT_MS))) {
        failed.push(ip);
      }
    }
    if (failed.length > 0) {
      bad.push({ name: server.name, ips: failed });
    }
  }
  return bad;
}

/**
 * IPv6 addresses of the web server that accept no connection on port 80 nor
 * 443 (Internet.nl `web_reach`).
 */
export async function unreachableWebAddresses(v6: string[]): Promise<string[]> {
  const bad: string[] = [];
  for (const ip of v6) {
    let ok = false;
    for (const port of [80, 443]) {
      if (await network.connect(ip, port, CONNECT_TIMEOUT_MS)) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      bad.push(ip);
    }
  }
  return bad;
}

/** Removes the parts of a page that legitimately differ between requests. */
export function stripIrrelevantHtml(html: string): string {
  return html
    .replace(
      /(<(?:script|style)\b[^>]*?)\s+nonce\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
      '$1',
    )
    .replace(/<input\b[^>]*name\s*=\s*["']?__VIEWSTATE["']?[^>]*>/gi, '');
}

/**
 * Python's `SequenceMatcher.quick_ratio`: an upper bound of the similarity
 * of two strings computed from their character counts (0..1).
 */
export function quickRatio(a: string, b: string): number {
  if (a.length + b.length === 0) {
    return 1;
  }
  const available = new Map<string, number>();
  for (const ch of b) {
    available.set(ch, (available.get(ch) ?? 0) + 1);
  }
  let matches = 0;
  for (const ch of a) {
    const left = available.get(ch) ?? 0;
    if (left > 0) {
      matches++;
      available.set(ch, left - 1);
    }
  }
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
  const ports = new Set<number>();
  let response: WebResponse | null = null;
  for (const port of [80, 443]) {
    for (const ip of ips) {
      const r = await network.get(host, ip, port, port === 443);
      if (r) {
        ports.add(port);
        response = r;
        break;
      }
    }
  }
  return { ports, response };
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
