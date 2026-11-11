/**
 * A `tlsProbe.connect` that makes the handshake somewhere else: a prober that
 * answers JSON (plumbline's container, reached through its Worker). A browser
 * cannot open the TLS connections the checks inspect, so the web app swaps this
 * in for the Node one (`tlsProbe.connect = remoteConnect(...)`), and the same
 * checks run unchanged.
 *
 * The prober is built on OpenSSL, as Node is, so it takes the same cipher
 * lists, signature algorithm lists and key groups and reports the same names.
 * What it leaves out of its build (RC4, DES and other legacy algorithms) is
 * just not offered, which a server that insisted on them would show as a
 * failed handshake.
 */
import type { PeerCertificate } from '#tls';
import { TLS_VERSIONS, type TlsVersion } from './constants.js';
import type { EphemeralKey } from './evaluate.js';
import type { ProbeResult, TlsConnect } from './client.js';

/** The certificate facts the prober reads, named as Node names them. */
export interface RemoteCertificate {
  subject: Record<string, string>;
  issuer: Record<string, string>;
  subjectaltname: string;
  valid_from: string;
  valid_to: string;
  serialNumber: string;
  fingerprint256: string;
  keyType: string;
  bits?: number;
  asn1Curve?: string;
  signatureAlgorithm: string;
  /** Where the issuer's certificate and an OCSP answer can be had, as Node names the keys. */
  infoAccess?: Record<string, string[]>;
}

/** What the prober answers. */
export interface RemoteHandshake {
  protocol: string;
  cipher: { name: string; standardName: string };
  authorized: boolean;
  authorizationError: string | null;
  ephemeral: EphemeralKey | null;
  /** DER, base64, leaf first. */
  chain: string[] | null;
  certificates: RemoteCertificate[] | null;
  /** DER, base64. */
  ocsp: string | null;
  compression?: boolean;
}

/** What is asked of the prober. */
export interface RemoteRequest {
  host: string;
  port: number;
  starttls?: 'smtp';
  minVersion?: string;
  maxVersion?: string;
  /** An OpenSSL cipher list. */
  ciphers?: string;
  /** An OpenSSL signature algorithm list. */
  sigalgs?: string;
  /** Colon separated key exchange groups. */
  ecdhCurve?: string;
  requestOCSP?: boolean;
}

/** Makes one request to the prober; rejects when the handshake failed. */
export type RemoteCall = (request: RemoteRequest) => Promise<RemoteHandshake>;

/** The base64 text as bytes. */
function bytesOf(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/** The leaf certificate as Node shows it, from what the prober read. */
function peerOf(
  certs: readonly RemoteCertificate[],
  chain: readonly Buffer[],
): PeerCertificate {
  const leaf = certs[0];
  return {
    subject: leaf?.subject ?? {},
    issuer: leaf?.issuer ?? {},
    subjectaltname: leaf?.subjectaltname,
    valid_from: leaf?.valid_from,
    valid_to: leaf?.valid_to,
    serialNumber: leaf?.serialNumber,
    fingerprint256: leaf?.fingerprint256,
    bits: leaf?.bits,
    asn1Curve: leaf?.asn1Curve,
    infoAccess: leaf?.infoAccess,
    raw: chain[0],
  } as unknown as PeerCertificate;
}

/** A `TlsConnect` that asks the prober. */
export function remoteConnect(call: RemoteCall): TlsConnect {
  return async (target, options) => {
    const answer = await call({
      host: target.host,
      port: target.port,
      ...(target.starttls ? { starttls: target.starttls } : {}),
      ...(options.minVersion ? { minVersion: options.minVersion } : {}),
      ...(options.maxVersion ? { maxVersion: options.maxVersion } : {}),
      ...(options.ciphers ? { ciphers: options.ciphers } : {}),
      ...(options.sigalgs ? { sigalgs: options.sigalgs } : {}),
      ...(options.ecdhCurve ? { ecdhCurve: options.ecdhCurve } : {}),
      ...(options.requestOCSP ? { requestOCSP: true } : {}),
    });
    const chain = (answer.chain ?? []).map((cert) => bytesOf(cert));
    const protocol = (TLS_VERSIONS as readonly string[]).includes(
      answer.protocol,
    )
      ? (answer.protocol as TlsVersion)
      : null;
    const result: ProbeResult = {
      protocol,
      cipher: answer.cipher,
      ephemeral: answer.ephemeral,
      authorized: answer.authorized,
      authorizationError: answer.authorizationError,
      chain,
      peerCertificate: peerOf(answer.certificates ?? [], chain),
      ocspResponse: answer.ocsp ? bytesOf(answer.ocsp) : null,
    };
    return result;
  };
}
