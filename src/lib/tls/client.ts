/**
 * The TLS probing layer shared by the Internet.nl TLS and certificate
 * hints. It only uses Node's `tls` module (no native binaries, no
 * `openssl`): every probe is one handshake, made with `tls.connect`.
 *
 * Hints never call `tls.connect` themselves. They use `tlsProbe.connect`,
 * which tests replace or point at a local `node:tls` server through
 * `tlsProbe.port` and `tlsProbe.ca`, so tests never touch the internet.
 */
import tls, {
  type ConnectionOptions,
  type DetailedPeerCertificate,
  type PeerCertificate,
} from 'node:tls';
import { isIP } from 'node:net';
import { TLS_VERSIONS, type TlsVersion } from './constants.js';
import type { CipherInfo, EphemeralKey } from './evaluate.js';

/** Where to connect: the scanned host on the HTTPS port. */
export interface TlsTarget {
  host: string;
  port: number;
}

/** Settings of one handshake. */
export interface ProbeOptions {
  minVersion?: TlsVersion;
  maxVersion?: TlsVersion;
  /** An OpenSSL cipher list string; `@SECLEVEL=0` is always appended. */
  ciphers?: string;
  /** Colon separated curve names offered for ECDHE. */
  ecdhCurve?: string;
  /** OpenSSL signature algorithm list, for example `RSA+SHA1`. */
  sigalgs?: string;
  /** Ask the server to staple an OCSP response. */
  requestOCSP?: boolean;
}

/** What a successful handshake revealed. */
export interface ProbeResult {
  protocol: TlsVersion | null;
  cipher: CipherInfo;
  ephemeral: EphemeralKey | null;
  /** Whether the chain validated against the trusted roots. */
  authorized: boolean;
  /** Why validation failed, for example `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. */
  authorizationError: string | null;
  /** The certificate chain as DER, leaf first, root last when received. */
  chain: Buffer[];
  /** Node's view of the leaf, for `checkServerIdentity` and OCSP info. */
  peerCertificate: PeerCertificate;
  /** The stapled OCSP response, if any. */
  ocspResponse: Buffer | null;
}

/** Makes one handshake; rejects when the handshake fails. */
export type TlsConnect = (
  target: TlsTarget,
  options: ProbeOptions,
) => Promise<ProbeResult>;

/** Seconds a probe may take before it counts as failed. */
const PROBE_TIMEOUT_MS = 8000;

/** Builds the `ciphers` option; security level 0 allows legacy suites. */
function cipherString(ciphers: string | undefined): string {
  return `${ciphers ?? 'DEFAULT'}:@SECLEVEL=0`;
}

/** The chain of a connection as DER buffers, leaf first. */
function collectChain(socket: tls.TLSSocket): Buffer[] {
  const chain: Buffer[] = [];
  let cert: DetailedPeerCertificate | undefined =
    socket.getPeerCertificate(true);
  // For a self-signed certificate `issuerCertificate` points at itself.
  while (cert?.raw && !chain.some((der) => der.equals(cert?.raw as Buffer))) {
    chain.push(cert.raw);
    cert = cert.issuerCertificate;
  }
  return chain;
}

/**
 * Connects with `tls.connect`, does not reject untrusted certificates (the
 * hints judge them) and reports everything the handshake exposed.
 */
export const connectWithNode: TlsConnect = (target, options) =>
  new Promise<ProbeResult>((resolve, reject) => {
    let ocspResponse: Buffer | null = null;
    // `requestOCSP` is a documented TLSSocket option missing from the typings.
    const connectOptions: ConnectionOptions & { requestOCSP?: boolean } = {
      host: target.host,
      port: target.port,
      // SNI must be a name, never an IP address.
      servername: isIP(target.host) ? undefined : target.host,
      rejectUnauthorized: false,
      ca: tlsProbe.ca,
      minVersion: options.minVersion,
      maxVersion: options.maxVersion,
      ciphers: cipherString(options.ciphers),
      ecdhCurve: options.ecdhCurve,
      sigalgs: options.sigalgs,
      requestOCSP: options.requestOCSP,
    };
    const socket = tls.connect(connectOptions);
    socket.setTimeout(PROBE_TIMEOUT_MS, () =>
      socket.destroy(new Error('TLS probe timed out')),
    );
    socket.once('OCSPResponse', (response: Buffer | null) => {
      ocspResponse = response;
    });
    socket.once('error', reject);
    socket.once('secureConnect', () => {
      const cipher = socket.getCipher();
      const key = socket.getEphemeralKeyInfo() as
        { type?: string; size?: number; name?: string } | Record<string, never>;
      const ephemeral: EphemeralKey | null =
        (key.type === 'DH' || key.type === 'ECDH') && key.size !== undefined
          ? { type: key.type, size: key.size, name: key.name }
          : null;
      const error = socket.authorizationError;
      const result: ProbeResult = {
        protocol: socket.getProtocol() as TlsVersion | null,
        cipher: { name: cipher.name, standardName: cipher.standardName },
        ephemeral,
        authorized: socket.authorized,
        authorizationError: error ? String(error) : null,
        chain: collectChain(socket),
        peerCertificate: socket.getPeerCertificate(),
        ocspResponse,
      };
      socket.end();
      resolve(result);
    });
  });

/**
 * The probing settings hints use. Tests assign `connect`, `port` and `ca`;
 * production leaves the defaults.
 */
export const tlsProbe: {
  connect: TlsConnect;
  /** The HTTPS port of the scanned host. */
  port: number;
  /** Trusted roots; `undefined` uses Node's bundled Mozilla roots. */
  ca: string | Buffer | undefined;
} = { connect: connectWithNode, port: 443, ca: undefined };

/** The target for a scanned site: its host on the HTTPS port. */
export function targetFor(url: URL): TlsTarget {
  // `hostname` of an IPv6 URL still carries the brackets.
  return {
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: tlsProbe.port,
  };
}

/** Makes a handshake and returns null instead of rejecting. */
export async function tryConnect(
  target: TlsTarget,
  options: ProbeOptions,
): Promise<ProbeResult | null> {
  try {
    return await tlsProbe.connect(target, options);
  } catch {
    return null;
  }
}

/** Probes each TLS version separately and returns those the server accepts. */
export async function supportedVersions(
  target: TlsTarget,
): Promise<TlsVersion[]> {
  const accepted: TlsVersion[] = [];
  for (const version of TLS_VERSIONS) {
    const result = await tryConnect(target, {
      minVersion: version,
      maxVersion: version,
    });
    if (result?.protocol === version) {
      accepted.push(version);
    }
  }
  return accepted;
}

/** What enumerating ciphers found for one version. */
export interface AcceptedCipher extends CipherInfo {
  version: TlsVersion;
  ephemeral: EphemeralKey | null;
}

/** All TLS 1.3 suites OpenSSL knows, offered when probing TLS 1.3. */
const TLS_1_3_OFFER = [
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256',
  'TLS_AES_128_GCM_SHA256',
  'TLS_AES_128_CCM_SHA256',
  'TLS_AES_128_CCM_8_SHA256',
];

/** Upper bound on handshakes per version, so a broken server cannot loop. */
const MAX_CIPHER_PROBES = 80;

/**
 * Finds the cipher suites a server accepts for one TLS version by
 * iterative removal, as Internet.nl does: offer every suite, note the one
 * the server picks, remove it from the offer and connect again until the
 * server has nothing left it accepts.
 */
export async function acceptedCiphers(
  target: TlsTarget,
  version: TlsVersion,
): Promise<AcceptedCipher[]> {
  const found: AcceptedCipher[] = [];
  // Everything OpenSSL can offer below TLS 1.3, including NULL and anonymous
  // suites; for TLS 1.3 the fixed list of its suites.
  const all =
    version === 'TLSv1.3'
      ? TLS_1_3_OFFER.join(':')
      : 'ALL:COMPLEMENTOFALL:aNULL:eNULL';
  for (let i = 0; i < MAX_CIPHER_PROBES; i++) {
    const removed = found.map((c) =>
      version === 'TLSv1.3' ? c.name : `!${c.name}`,
    );
    const offer =
      version === 'TLSv1.3'
        ? // `DEFAULT` keeps the (unused) cipher list for older versions valid.
          `${TLS_1_3_OFFER.filter((n) => !removed.includes(n)).join(':')}:DEFAULT`
        : [all, ...removed].join(':');
    if (version === 'TLSv1.3' && offer.startsWith(':')) {
      break;
    }
    const result = await tryConnect(target, {
      minVersion: version,
      maxVersion: version,
      ciphers: offer,
    });
    if (result === null || found.some((c) => c.name === result.cipher.name)) {
      break;
    }
    found.push({ ...result.cipher, version, ephemeral: result.ephemeral });
  }
  return found;
}

/** The highest accepted version below TLS 1.3, if any. */
export function highestLegacyVersion(
  versions: readonly TlsVersion[],
): TlsVersion | null {
  return (
    TLS_VERSIONS.find((v) => v !== 'TLSv1.3' && versions.includes(v)) ?? null
  );
}

/** The resource a TLS finding is reported against. */
export function resourceFor(target: TlsTarget): string {
  const host = target.host.includes(':') ? `[${target.host}]` : target.host;
  return `https://${host}${target.port === 443 ? '' : `:${target.port}`}/`;
}

/**
 * Curves offered when a certificate cannot be fetched with the defaults. A
 * TLS 1.2 client only accepts an EC certificate key on a curve it listed,
 * and Node's default list leaves out secp224r1 and secp256k1.
 */
const CERTIFICATE_CURVES =
  'X25519:prime256v1:secp384r1:secp521r1:secp224r1:secp256k1:brainpoolP256r1:brainpoolP384r1:brainpoolP512r1';

/**
 * Fetches the certificate chain of a server. It connects with the defaults
 * first. If that fails, it tries once more with TLS 1.2 and a wide list of
 * curves, so a certificate with a weak curve can still be examined (and
 * rated) instead of being reported as "could not test".
 */
export async function fetchCertificate(
  target: TlsTarget,
  options: ProbeOptions = {},
): Promise<ProbeResult | null> {
  return (
    (await tryConnect(target, options)) ??
    (await tryConnect(target, {
      ...options,
      maxVersion: 'TLSv1.2',
      ecdhCurve: CERTIFICATE_CURVES,
    }))
  );
}
