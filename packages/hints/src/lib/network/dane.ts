/**
 * DANE checks ported from Internet.nl (checks/tasks/tls/scans.py,
 * `dane`): a TLSA record exists for `_443._tcp.<host>` and is secured by
 * DNSSEC, and it matches the certificate the server presents. Internet.nl
 * delegates matching to `ldns-dane`; this module implements RFC 6698
 * matching with Node's crypto so no native tool is needed.
 */
import { X509Certificate, createHash } from '#crypto';
import { connect as tlsConnect } from '#tls';
import { answersOfType, normalizeName, safeQuery, RR } from './dns-util.js';

export interface Tlsa {
  usage: number;
  selector: number;
  matching: number;
  /** Lower-case hex of the certificate association data. */
  data: string;
}

/** The certificate chain a server presented, leaf first, as DER buffers. */
export interface PresentedChain {
  chain: Buffer[];
  /** True when the chain also validates against the system trust store. */
  pkixValid: boolean;
}

export type ChainFetcher = (
  host: string,
  port: number,
) => Promise<PresentedChain | null>;

/** Real TLS connection that reads the presented chain. */
const fetchChain: ChainFetcher = (host, port) =>
  new Promise((resolve) => {
    const socket = tlsConnect({
      host,
      port,
      servername: host,
      // We inspect the chain ourselves and read `authorized` for PKIX.
      rejectUnauthorized: false,
      timeout: 8000,
    });
    socket.once('secureConnect', () => {
      const chain: Buffer[] = [];
      let cert = socket.getPeerCertificate(true);
      const seen = new Set<string>();
      while (cert && cert.raw && !seen.has(cert.fingerprint256)) {
        seen.add(cert.fingerprint256);
        chain.push(cert.raw);
        cert = cert.issuerCertificate;
      }
      const pkixValid = socket.authorized;
      socket.destroy();
      resolve(chain.length > 0 ? { chain, pkixValid } : null);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(null);
    });
    socket.once('error', () => resolve(null));
  });

/** The TLS client the hints use; tests assign a fake. */
export const tls: { fetchChain: ChainFetcher } = { fetchChain };

/**
 * Parses one TLSA record in presentation format (`3 1 1 abcd...`) or in the
 * generic form some resolvers use (`\# 35 030101abcd...`).
 */
export function parseTlsa(data: string): Tlsa | null {
  const generic = /^\\#\s+\d+\s+([0-9a-fA-F\s]+)$/.exec(data.trim());
  if (generic) {
    const hex = generic[1].replace(/\s+/g, '').toLowerCase();
    if (hex.length < 6) {
      return null;
    }
    return {
      usage: parseInt(hex.slice(0, 2), 16),
      selector: parseInt(hex.slice(2, 4), 16),
      matching: parseInt(hex.slice(4, 6), 16),
      data: hex.slice(6),
    };
  }
  const m = /^(\d+)\s+(\d+)\s+(\d+)\s+([0-9a-fA-F\s]+)$/.exec(data.trim());
  if (!m) {
    return null;
  }
  return {
    usage: Number(m[1]),
    selector: Number(m[2]),
    matching: Number(m[3]),
    data: m[4].replace(/\s+/g, '').toLowerCase(),
  };
}

/**
 * `none`: no TLSA record (or not DNSSEC secured, as Internet.nl requires);
 * `bogus`: the resolver failed validation of the TLSA lookup;
 * `exists`: secured TLSA records are published.
 */
export type DaneExistence =
  { state: 'none' } | { state: 'bogus' } | { state: 'exists'; records: Tlsa[] };

/** Renders a record as a zone file line, for use as report evidence. */
export function formatTlsa(record: Tlsa, name: string): string {
  return `${name}. IN TLSA ${record.usage} ${record.selector} ${record.matching} ${record.data}`;
}

/**
 * Internet.nl's DANE rollover test: an active scheme has at least two usable
 * records, either two DANE-EE(3) records (the current and the next key) or a
 * DANE-EE(3) and a DANE-TA(2) record (the current key and its issuer). Other
 * usages do not count towards a scheme.
 */
export function hasDaneRollover(
  records: readonly { usage: number }[],
): boolean {
  const daneEe = records.filter((record) => record.usage === 3).length;
  const daneTa = records.filter((record) => record.usage === 2).length;
  return daneEe > 1 || (daneEe > 0 && daneTa > 0);
}

/** Looks up the TLSA records of `_<port>._tcp.<host>`. */
export async function daneExistence(
  host: string,
  port = 443,
): Promise<DaneExistence> {
  const response = await safeQuery(`_${port}._tcp.${host}`, 'TLSA');
  if (!response) {
    return { state: 'none' };
  }
  // A validating resolver answers SERVFAIL when the proof of (non)existence
  // does not validate, which Internet.nl reports as "bogus".
  if (response.status === 2) {
    return { state: 'bogus' };
  }
  const records = answersOfType(response, RR.TLSA)
    .map((a) => parseTlsa(a.data))
    .filter((r): r is Tlsa => r !== null);
  // DNSSEC is preconditional for DANE: unsigned records do not count.
  if (records.length === 0 || !response.authenticated) {
    return { state: 'none' };
  }
  return { state: 'exists', records };
}

/** The selected part of the certificate, hashed as the record asks. */
function associationData(
  cert: Buffer,
  selector: number,
  matching: number,
): string | null {
  let selected: Buffer;
  if (selector === 0) {
    selected = cert;
  } else if (selector === 1) {
    try {
      selected = new X509Certificate(cert).publicKey.export({
        type: 'spki',
        format: 'der',
      });
    } catch {
      return null;
    }
  } else {
    return null;
  }
  if (matching === 0) {
    return selected.toString('hex');
  }
  if (matching === 1 || matching === 2) {
    return createHash(matching === 1 ? 'sha256' : 'sha512')
      .update(selected)
      .digest('hex');
  }
  return null;
}

/** True when the record uses values defined by RFC 6698. */
const usable = (r: Tlsa): boolean =>
  r.usage <= 3 && r.selector <= 1 && r.matching <= 2;

/**
 * Does any usable TLSA record match the presented chain? Usage 3 (DANE-EE)
 * and 1 (PKIX-EE) match the leaf, 2 (DANE-TA) and 0 (PKIX-TA) a certificate
 * higher in the chain. The PKIX usages also need a PKIX valid chain.
 */
export function tlsaMatches(
  records: Tlsa[],
  presented: PresentedChain,
): boolean {
  const [leaf, ...issuers] = presented.chain;
  return records.filter(usable).some((r) => {
    if ((r.usage === 0 || r.usage === 1) && !presented.pkixValid) {
      return false;
    }
    const candidates = r.usage === 1 || r.usage === 3 ? [leaf] : issuers;
    return candidates.some(
      (cert) => associationData(cert, r.selector, r.matching) === r.data,
    );
  });
}

export type DaneValidity = 'valid' | 'invalid' | 'untested';

/** Internet.nl `dane_valid`: does the TLSA data match the web certificate? */
export async function daneValidity(
  host: string,
  records: Tlsa[],
  port = 443,
): Promise<DaneValidity> {
  const presented = await tls.fetchChain(normalizeName(host), port);
  if (!presented) {
    return 'untested';
  }
  return tlsaMatches(records, presented) ? 'valid' : 'invalid';
}
