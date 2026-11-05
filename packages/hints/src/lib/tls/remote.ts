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

/** A certificate name, as the prober writes it. */
export interface RemoteName {
  common_name?: string;
  organization?: string;
  country?: string;
}

/** The certificate facts the prober reads. */
export interface RemoteCertificate {
  subject: RemoteName;
  issuer: RemoteName;
  subject_alt_names: string;
  valid_from: string;
  valid_to: string;
  serial_number: string;
  fingerprint256: string;
  key_type: string;
  bits?: number;
  asn1_curve?: string;
  signature_algorithm: string;
}

/** What the prober answers. */
export interface RemoteHandshake {
  protocol: string;
  cipher: { name: string; standard_name: string };
  authorized: boolean;
  authorization_error: string | null;
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
  min_version?: string;
  max_version?: string;
  /** An OpenSSL cipher list. */
  ciphers?: string;
  /** An OpenSSL signature algorithm list. */
  sigalgs?: string;
  /** Colon separated key exchange groups. */
  ecdh_curve?: string;
  request_ocsp?: boolean;
}

/** Makes one request to the prober; rejects when the handshake failed. */
export type RemoteCall = (request: RemoteRequest) => Promise<RemoteHandshake>;

/** The base64 text as bytes. */
function bytesOf(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/** A name as Node shows it: `CN`, `O` and `C`. */
function nodeName(name: RemoteName | undefined): Record<string, string> {
  return {
    ...(name?.common_name ? { CN: name.common_name } : {}),
    ...(name?.organization ? { O: name.organization } : {}),
    ...(name?.country ? { C: name.country } : {}),
  };
}

/** The leaf certificate as Node shows it, from what the prober read. */
function peerOf(
  certs: readonly RemoteCertificate[],
  chain: readonly Buffer[],
): PeerCertificate {
  const leaf = certs[0];
  return {
    subject: nodeName(leaf?.subject),
    issuer: nodeName(leaf?.issuer),
    subjectaltname: leaf?.subject_alt_names,
    valid_from: leaf?.valid_from,
    valid_to: leaf?.valid_to,
    serialNumber: leaf?.serial_number,
    fingerprint256: leaf?.fingerprint256,
    bits: leaf?.bits,
    asn1Curve: leaf?.asn1_curve,
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
      ...(options.minVersion ? { min_version: options.minVersion } : {}),
      ...(options.maxVersion ? { max_version: options.maxVersion } : {}),
      ...(options.ciphers ? { ciphers: options.ciphers } : {}),
      ...(options.sigalgs ? { sigalgs: options.sigalgs } : {}),
      ...(options.ecdhCurve ? { ecdh_curve: options.ecdhCurve } : {}),
      ...(options.requestOCSP ? { request_ocsp: true } : {}),
    });
    const chain = (answer.chain ?? []).map(bytesOf);
    const protocol = (TLS_VERSIONS as readonly string[]).includes(
      answer.protocol,
    )
      ? (answer.protocol as TlsVersion)
      : null;
    const result: ProbeResult = {
      protocol,
      cipher: {
        name: answer.cipher.name,
        standardName: answer.cipher.standard_name,
      },
      ephemeral: answer.ephemeral,
      authorized: answer.authorized,
      authorizationError: answer.authorization_error,
      chain,
      peerCertificate: peerOf(answer.certificates ?? [], chain),
      ocspResponse: answer.ocsp ? bytesOf(answer.ocsp) : null,
    };
    return result;
  };
}
