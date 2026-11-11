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

import {
  dns,
  type DnsResponse,
} from '@mridang/webhint-hint-plumbline/dist/core/dns.js';
import {
  rpki,
  type RpkiResult,
} from '@mridang/webhint-hint-plumbline/dist/core/rpki.js';
import { compression } from '@mridang/webhint-hint-plumbline/dist/lib/network/compression.js';
import { tls as dane } from '@mridang/webhint-hint-plumbline/dist/lib/network/dane.js';
import { network } from '@mridang/webhint-hint-plumbline/dist/lib/network/ipv6.js';
import { mailNet } from '@mridang/webhint-hint-plumbline/dist/lib/email/net.js';
import {
  tlsProbe,
  type ProbeResult,
} from '@mridang/webhint-hint-plumbline/dist/lib/tls/client.js';
import { openssl } from '@mridang/webhint-hint-plumbline/dist/lib/tls/openssl.js';
import { remoteConnect } from '@mridang/webhint-hint-plumbline/dist/lib/tls/remote.js';

import type { ProbeClient } from './client.js';
import { unchunk } from './fetch.js';
import {
  fromBase64,
  ProbeError,
  ProbeUnavailableError,
  type RemoteCertificate,
} from './protocol.js';

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
    { client, answers: new Map(), routes: new Map(), handshakes: new Map() },
    work,
  );
}

/** The newest `fetch` before the first scan replaced it, for calls outside a scan. */
let installed = false;

/** The bytes as a Buffer. */
function bufferOf(base64: string): Buffer {
  return Buffer.from(fromBase64(base64));
}

/** The text of the lines of an `openssl` argument list, parsed into what the probe takes. */
function parseSClient(args: readonly string[]): {
  host: string;
  port: number;
  servername?: string;
  starttls?: 'smtp';
  flags: string[];
  sessionOut?: string;
  sessionIn?: string;
  earlyDataFile?: string;
} {
  let host = '';
  let port = 0;
  let servername: string | undefined;
  let starttls: 'smtp' | undefined;
  const flags: string[] = [];
  let sessionOut: string | undefined;
  let sessionIn: string | undefined;
  let earlyDataFile: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? '';
    const next = args[i + 1] ?? '';
    switch (arg) {
      case 's_client': {
        break;
      }
      case '-connect': {
        const match = /^\[?([^\]]+?)\]?:(\d+)$/.exec(next);
        host = match?.[1] ?? '';
        port = Number(match?.[2] ?? 0);
        i += 1;
        break;
      }
      case '-servername': {
        servername = next;
        i += 1;
        break;
      }
      case '-starttls': {
        starttls = next === 'smtp' ? 'smtp' : undefined;
        i += 1;
        break;
      }
      case '-sess_out': {
        sessionOut = next;
        i += 1;
        break;
      }
      case '-sess_in': {
        sessionIn = next;
        i += 1;
        break;
      }
      case '-early_data': {
        earlyDataFile = next;
        i += 1;
        break;
      }
      default: {
        flags.push(arg);
      }
    }
  }
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
  return path.replaceAll(/[^A-Za-z0-9]/g, '_').slice(-80);
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
  dns.client = {
    query: (name, type) => {
      const answers = scope.getStore()?.answers;
      if (!answers) {
        return resolver.query(name, type);
      }
      const key = `${type} ${name.toLowerCase()}`;
      let answer = answers.get(key);
      if (!answer) {
        answer = resolver.query(name, type);
        answers.set(key, answer);
        answer.catch(() => answers.delete(key));
      }
      return answer;
    },
  };
}

/** Caches the routing lookups within one scan. */
function installRpkiCache(): void {
  // The four routing checks ask about the same addresses (a web server is also a name server),
  // and each answer is two round trips to a web service: within one scan, one lookup per address.
  const validator = rpki.client;
  rpki.client = {
    check: (ip) => {
      const routes = scope.getStore()?.routes;
      if (!routes) {
        return validator.check(ip);
      }
      let answer = routes.get(ip);
      if (!answer) {
        answer = validator.check(ip);
        routes.set(ip, answer);
        answer.catch(() => routes.delete(ip));
      }
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
  tlsProbe.connect = (target, options) => {
    const scanned = scope.getStore();
    if (!scanned) {
      return connectWithNode(target, options);
    }
    const key = JSON.stringify([target, options]);
    let handshake = scanned.handshakes.get(key);
    if (!handshake) {
      const { client, handshakes } = scanned;
      handshake = remoteConnect((request) =>
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
      handshakes.set(key, handshake);
      void (async () => {
        try {
          await handshake;
        } catch (error) {
          if (error instanceof ProbeUnavailableError) {
            handshakes.delete(key);
          }
        }
      })();
    }
    return handshake;
  };
}

/** Sends the mail checks through the probe. */
function installMailClient(): void {
  const nodeMail = mailNet.client;
  mailNet.client = {
    tcpReachable: (ip, port) => {
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
          name.toLowerCase() === 'transfer-encoding' && /chunked/i.test(value),
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
  const nodeChain = dane.fetchChain;
  dane.fetchChain = async (host, port) => {
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
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
  );
  if (!pems || pems.length === 0) {
    throw new ProbeError('the probe has no trusted roots');
  }
  roots.push(...pems);
}
