/**
 * @packageDocumentation
 *
 * Puts the probe under the network clients the checks use. The hints package
 * keeps each of them as a replaceable function on a shared object (so its own
 * tests can swap in fakes): the TLS handshake, the mail checks' connections, the
 * IPv6 tests, the compression test, the DANE chain fetch and the `openssl`
 * command. In Node they do real socket work; here each asks the probe instead.
 *
 * They are replaced once for the whole process by functions that look up the
 * probe of the scan that is running (an `AsyncLocalStorage`), so scans of
 * different sites, in the same isolate, never use each other's probe, and code
 * outside a scan finds the original behaviour.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import nodeTls from 'node:tls';

import { dns } from '@mridang/webhint-hint-plumbline/dist/core/dns.js';
import { rpki } from '@mridang/webhint-hint-plumbline/dist/core/rpki.js';
import { compression } from '@mridang/webhint-hint-plumbline/dist/lib/network/compression.js';
import { tls } from '@mridang/webhint-hint-plumbline/dist/lib/network/dane.js';
import { network } from '@mridang/webhint-hint-plumbline/dist/lib/network/ipv6.js';
import { mailNet } from '@mridang/webhint-hint-plumbline/dist/lib/email/net.js';
import { tlsProbe } from '@mridang/webhint-hint-plumbline/dist/lib/tls/client.js';
import { openssl } from '@mridang/webhint-hint-plumbline/dist/lib/tls/openssl.js';
import { remoteConnect } from '@mridang/webhint-hint-plumbline/dist/lib/tls/remote.js';

import { unchunk } from './fetch.js';
import { fromBase64, ProbeError, ProbeUnavailableError } from './protocol.js';
import type { RemoteCertificate } from './protocol.js';
import type { ProbeResult } from '@mridang/webhint-hint-plumbline/dist/lib/tls/client.js';
import type { ProbeClient } from './client.js';
import type { RpkiResult } from '@mridang/webhint-hint-plumbline/dist/core/rpki.js';
import type { DnsResponse } from '@mridang/webhint-hint-plumbline/dist/core/dns.js';

/** Captures the host (optionally in brackets) and the port of a `host:port` pair. */
const HOST_AND_PORT = /^\[?([^\]]+?)\]?:(\d+)$/u;

/** Matches a `chunked` transfer encoding. */
const CHUNKED_ENCODING = /chunked/iu;

/** What the scan that is running here uses: its probe, and the DNS answers it has already had. */
interface ScanScope {
  readonly client: ProbeClient;
  readonly answers: Map<string, Promise<DnsResponse>>;
  readonly routes: Map<string, Promise<RpkiResult>>;
  readonly handshakes: Map<string, Promise<ProbeResult>>;
}

/** The scan that is running here, if one is. */
const scope = new AsyncLocalStorage<ScanScope>();

/** Runs `work` with `client` as the probe every network client of the checks uses. */
export function withProbe<T>(client: ProbeClient, work: () => T): T {
  install();
  return scope.run(
    {
      client,
      answers: new Map<string, Promise<DnsResponse>>(),
      routes: new Map<string, Promise<RpkiResult>>(),
      handshakes: new Map<string, Promise<ProbeResult>>(),
    },
    work,
  );
}

/** The newest `fetch` before the first scan replaced it, for calls outside a scan. */
// eslint-disable-next-line functional/no-let -- set once, when the network clients are replaced
let installed = false;

/** The bytes as a Buffer. */
function bufferOf(base64: string): Buffer {
  return Buffer.from(fromBase64(base64));
}

/** An `openssl s_client` argument list, parsed into what the probe takes. */
interface SClientArgs {
  host: string;
  port: number;
  servername?: string;
  starttls?: 'smtp';
  flags: string[];
  sessionOut?: string;
  sessionIn?: string;
  earlyDataFile?: string;
}

/** The text of the lines of an `openssl` argument list, parsed into what the probe takes. */
function parseSClient(args: readonly string[]): SClientArgs {
  const walk = (index: number, found: SClientArgs): SClientArgs => {
    if (index >= args.length) {
      return found;
    }
    const arg = args[index] ?? '';
    const next = args[index + 1] ?? '';
    switch (arg) {
      case 's_client': {
        return walk(index + 1, found);
      }
      case '-connect': {
        const match = HOST_AND_PORT.exec(next);
        return walk(index + 2, {
          ...found,
          host: match?.[1] ?? '',
          port: Number(match?.[2] ?? 0),
        });
      }
      case '-servername': {
        return walk(index + 2, { ...found, servername: next });
      }
      case '-starttls': {
        return walk(index + 2, {
          ...found,
          starttls: next === 'smtp' ? 'smtp' : undefined,
        });
      }
      case '-sess_out': {
        return walk(index + 2, { ...found, sessionOut: next });
      }
      case '-sess_in': {
        return walk(index + 2, { ...found, sessionIn: next });
      }
      case '-early_data': {
        return walk(index + 2, { ...found, earlyDataFile: next });
      }
      default: {
        return walk(index + 1, { ...found, flags: [...found.flags, arg] });
      }
    }
  };
  const {
    host,
    port,
    flags,
    servername,
    starttls,
    sessionOut,
    sessionIn,
    earlyDataFile,
  } = walk(0, { host: '', port: 0, flags: [] });
  return {
    host,
    port,
    flags,
    ...(servername ? { servername } : {}),
    ...(starttls ? { starttls } : {}),
    ...(sessionOut ? { sessionOut } : {}),
    ...(sessionIn ? { sessionIn } : {}),
    ...(earlyDataFile ? { earlyDataFile } : {}),
  };
}

/** A name for a session file the probe keeps: the path with what is not a letter or digit made safe. */
function sessionName(path: string): string {
  return path.replaceAll(/[^A-Za-z0-9]/gu, '_').slice(-80);
}

/** A copy of a certificate, with its own names and access URLs, so a cached answer is never shared. */
function copyCertificate({ infoAccess, ...certificate }: RemoteCertificate) {
  return {
    ...certificate,
    subject: { ...certificate.subject },
    issuer: { ...certificate.issuer },
    ...(infoAccess
      ? {
          infoAccess: Object.fromEntries(
            Object.entries(infoAccess).map(([name, urls]) => [name, [...urls]]),
          ),
        }
      : {}),
  };
}

/** Replaces the network clients of the checks, once. */
function install(): void {
  if (installed) {
    return;
  }
  installed = true;
  installDnsCache();
  installRpkiCache();
  installTlsHandshakeCache();
  installMailClient();
  installNetworkClient();
  installCompressionClient();
  installDaneClient();
  installOpensslClient();
}

/** Caches the DNS answers within one scan. */
function installDnsCache(): void {
  // The checks ask the same names again and again (a scan makes 160 queries for 60 names), so
  // within one scan an answer already had is reused; a Worker may have only a few requests
  // open at once, and each query is one.
  const resolver = dns.client;
  // eslint-disable-next-line functional/immutable-data -- the hints package keeps its DNS client as a replaceable property by design
  dns.client = {
    query: async (name, type) => {
      const answers = scope.getStore()?.answers;
      if (!answers) {
        return resolver.query(name, type);
      }
      const key = `${type} ${name.toLowerCase()}`;
      const cached = answers.get(key);
      if (cached) {
        return cached;
      }
      const answer = resolver.query(name, type);
      // eslint-disable-next-line functional/immutable-data -- the scan's answers are a cache that is filled as they come
      answers.set(key, answer);
      // eslint-disable-next-line functional/immutable-data -- a failed answer is dropped from the cache
      answer.catch(() => answers.delete(key));
      return answer;
    },
  };
}

/** Caches the routing lookups within one scan. */
function installRpkiCache(): void {
  // The four routing checks ask about the same addresses (a web server is also a name server),
  // and each answer is two round trips to a web service: within one scan, one lookup per address.
  const validator = rpki.client;
  // eslint-disable-next-line functional/immutable-data -- the hints package keeps its routing client as a replaceable property by design
  rpki.client = {
    check: async (ip) => {
      const routes = scope.getStore()?.routes;
      if (!routes) {
        return validator.check(ip);
      }
      const cached = routes.get(ip);
      if (cached) {
        return cached;
      }
      const answer = validator.check(ip);
      // eslint-disable-next-line functional/immutable-data -- the scan's routes are a cache that is filled as they come
      routes.set(ip, answer);
      // eslint-disable-next-line functional/immutable-data -- a failed lookup is dropped from the cache
      answer.catch(() => routes.delete(ip));
      return answer;
    },
  };
}

/** Makes each identical TLS handshake once within one scan. */
function installTlsHandshakeCache(): void {
  // Several checks enumerate the same server's versions and cipher suites with the same
  // handshakes, one after another (a mail handshake opens a session that takes seconds), and
  // what a server answers to the same offer does not change within a scan: an identical
  // handshake is made once. A handshake the server would not complete is an answer and is
  // kept; one the probe could not make (it was not there) is not.
  const connectWithNode = tlsProbe.connect;
  // eslint-disable-next-line functional/immutable-data -- the hints package keeps its handshake as a replaceable property by design
  tlsProbe.connect = async (target, options) => {
    const scanned = scope.getStore();
    if (!scanned) {
      return connectWithNode(target, options);
    }
    const key = JSON.stringify([target, options]);
    const cached = scanned.handshakes.get(key);
    if (cached) {
      return cached;
    }
    const { client, handshakes } = scanned;
    const handshake = remoteConnect(async (request) =>
      client
        .handshake({
          host: request.host,
          port: request.port,
          ...(request.starttls ? { starttls: request.starttls } : {}),
          ...(request.minVersion ? { min: request.minVersion } : {}),
          ...(request.maxVersion ? { max: request.maxVersion } : {}),
          ...(request.ciphers ? { ciphers: request.ciphers } : {}),
          ...(request.sigalgs ? { sigalgs: request.sigalgs } : {}),
          ...(request.ecdhCurve ? { curves: request.ecdhCurve } : {}),
          ...(request.requestOCSP ? { ocsp: true } : {}),
        })
        .then((answer) => ({
          ...answer,
          chain: [...answer.chain],
          certificates: answer.certificates.map((certificate) =>
            copyCertificate(certificate),
          ),
        })),
    )(target, options);
    // eslint-disable-next-line functional/immutable-data -- the scan's handshakes are a cache that is filled as they come
    handshakes.set(key, handshake);
    void (async () => {
      try {
        await handshake;
      } catch (error) {
        if (error instanceof ProbeUnavailableError) {
          // eslint-disable-next-line functional/immutable-data -- a handshake the probe could not make is dropped from the cache
          handshakes.delete(key);
        }
      }
    })();
    return handshake;
  };
}

/** Sends the mail checks through the probe. */
function installMailClient(): void {
  const nodeMail = mailNet.client;
  // eslint-disable-next-line functional/immutable-data -- the hints package keeps its mail client as a replaceable property by design
  mailNet.client = {
    tcpReachable: async (ip, port) => {
      const client = scope.getStore()?.client;
      return client
        ? client.reachable(ip, port)
        : nodeMail.tcpReachable(ip, port);
    },
    probeStarttls: async (host) => {
      const client = scope.getStore()?.client;
      if (!client) {
        return nodeMail.probeStarttls(host);
      }
      try {
        const answer = await client.starttls(host);
        return {
          reachable: answer.reachable,
          starttls: answer.starttls,
          tlsVersion: answer.tlsVersion,
          trusted: answer.trusted,
          trustError: answer.trustError,
          hostnameMatches: answer.hostnameMatches,
          certificates: answer.certificates.map((certificate) =>
            bufferOf(certificate),
          ),
          error: answer.error,
        };
      } catch (error) {
        return {
          reachable: false,
          starttls: false,
          tlsVersion: null,
          trusted: false,
          trustError: null,
          hostnameMatches: false,
          certificates: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/** Sends the raw connect and GET calls through the probe. */
function installNetworkClient(): void {
  const nodeConnect = network.connect;
  // eslint-disable-next-line functional/immutable-data -- the hints package keeps its connect as a replaceable property by design
  network.connect = async (ip, port, timeoutMs) => {
    const client = scope.getStore()?.client;
    if (!client) {
      return nodeConnect(ip, port, timeoutMs);
    }
    try {
      return await client.reachable(ip, port, timeoutMs);
    } catch {
      return false;
    }
  };
  const nodeGet = network.get;
  // eslint-disable-next-line functional/immutable-data -- the hints package keeps its GET as a replaceable property by design
  network.get = async (host, ip, port, https) => {
    const client = scope.getStore()?.client;
    if (!client) {
      return nodeGet(host, ip, port, https);
    }
    try {
      const answer = await client.http({
        host,
        ip,
        port,
        tls: https,
        method: 'GET',
        path: '/',
        headers: [
          ['user-agent', 'plumbline'],
          ['accept', '*/*'],
        ],
        maxBody: 500_000,
      });
      const chunked = answer.headers.some(
        ([name, value]) =>
          name.toLowerCase() === 'transfer-encoding' &&
          CHUNKED_ENCODING.test(value),
      );
      const body = chunked ? unchunk(answer.body) : answer.body;
      return {
        status: answer.status,
        body: Buffer.from(body).subarray(0, 500_000).toString('latin1'),
      };
    } catch {
      return null;
    }
  };
}

/** Sends the compression probe through the probe. */
function installCompressionClient(): void {
  const nodeProbe = compression.probe;
  // eslint-disable-next-line functional/immutable-data -- the hints package keeps its compression probe as a replaceable property by design
  compression.probe = async (url) => {
    const client = scope.getStore()?.client;
    if (!client) {
      return nodeProbe(url);
    }
    try {
      const tls = url.protocol === 'https:';
      const defaultPort = tls ? 443 : 80;
      const answer = await client.http({
        host: url.hostname,
        port: url.port === '' ? defaultPort : Number(url.port),
        tls,
        method: 'GET',
        path: `${url.pathname}${url.search}`,
        headers: [
          [
            'accept-encoding',
            'br, compress, deflate, exi, gzip, pack200-gzip, x-compress, x-gzip, zstd',
          ],
          ['user-agent', 'plumbline'],
        ],
        nobody: true,
      });
      return answer.headers
        .filter(([name]) => name.toLowerCase() === 'content-encoding')
        .map(([, value]) => value)
        .join(', ')
        .trim();
    } catch {
      return null;
    }
  };
}

/** Fetches the DANE certificate chain through the probe. */
function installDaneClient(): void {
  const nodeChain = tls.fetchChain;
  // eslint-disable-next-line functional/immutable-data -- the hints package keeps its chain fetch as a replaceable property by design
  tls.fetchChain = async (host, port) => {
    const client = scope.getStore()?.client;
    if (!client) {
      return nodeChain(host, port);
    }
    try {
      const answer = await client.handshake({ host, port });
      return answer.chain.length > 0
        ? {
            chain: answer.chain.map((link) => bufferOf(link)),
            pkixValid: answer.authorized,
          }
        : null;
    } catch {
      return null;
    }
  };
}

/** Runs the `openssl s_client` calls through the probe. */
function installOpensslClient(): void {
  const nodeExec = openssl.exec;
  // eslint-disable-next-line functional/immutable-data -- the hints package keeps its openssl runner as a replaceable property by design
  openssl.exec = async (args, options = {}) => {
    const client = scope.getStore()?.client;
    if (!client) {
      return nodeExec(args, options);
    }
    const parsed = parseSClient(args);
    const earlyData = parsed.earlyDataFile
      ? await readFile(parsed.earlyDataFile, 'latin1')
      : undefined;
    const answer = await client.openssl({
      host: parsed.host,
      port: parsed.port,
      flags: parsed.flags,
      ...(parsed.servername ? { servername: parsed.servername } : {}),
      ...(parsed.starttls ? { starttls: parsed.starttls } : {}),
      ...(parsed.sessionOut
        ? { sessionOut: sessionName(parsed.sessionOut) }
        : {}),
      ...(parsed.sessionIn ? { sessionIn: sessionName(parsed.sessionIn) } : {}),
      ...(earlyData === undefined ? {} : { earlyData }),
      input: options.input ?? [],
      delayMs: options.inputDelayMs ?? 0,
      timeoutMs: options.timeoutMs ?? 15_000,
    });
    return { stdout: answer.stdout, stderr: answer.stderr, code: answer.code };
  };
}

/**
 * Fills the trusted roots Node keeps in `tls.rootCertificates` (a Worker's list is
 * empty) from the probe's own bundle, once, so the checks that recognise a root
 * by its fingerprint see the same roots the probe judged the chain against.
 */
export async function ensureRoots(client: ProbeClient): Promise<void> {
  const roots = nodeTls.rootCertificates as string[];
  if (roots.length > 0) {
    return;
  }
  const bundle = await client.roots();
  const pems = bundle.match(
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/gu,
  );
  if (!pems || pems.length === 0) {
    throw new ProbeError('the probe has no trusted roots');
  }
  // eslint-disable-next-line functional/immutable-data -- the Node list of trusted roots is empty in a Worker and is filled from the probe's bundle
  roots.push(...pems);
}
