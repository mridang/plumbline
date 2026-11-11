import { X509Certificate, createHash } from '#crypto';

/** DNS record type number of a TLSA record. */
export const TLSA = 52;

/** A parsed TLSA record (RFC 6698). */
export interface TlsaRecord {
  /** Certificate usage: 0 PKIX-TA, 1 PKIX-EE, 2 DANE-TA, 3 DANE-EE. */
  usage: number;
  /** Selector: 0 full certificate, 1 SubjectPublicKeyInfo. */
  selector: number;
  /** Matching type: 0 exact, 1 SHA-256, 2 SHA-512. */
  matching: number;
  data: Buffer;
}

/**
 * Parses the presentation form of a TLSA record, either
 * `3 1 1 <hex>` or the generic form `\# <length> <hex>` (RFC 3597) that
 * resolvers use for types they do not know. Returns null when malformed.
 */
export function parseTlsa(text: string): TlsaRecord | null {
  const generic = /^\\#\s+(\d+)\s([0-9a-fA-F\s]*)$/u.exec(text.trim());
  if (generic) {
    const bytes = Buffer.from(generic[2].replaceAll(/\s+/gu, ''), 'hex');
    if (bytes.length !== Number(generic[1]) || bytes.length < 3) {
      return null;
    }
    return {
      usage: bytes[0],
      selector: bytes[1],
      matching: bytes[2],
      data: bytes.subarray(3),
    };
  }
  const match = /^(\d+)\s+(\d+)\s+(\d+)\s([0-9a-fA-F\s]+)$/u.exec(text.trim());
  if (!match) {
    return null;
  }
  const hex = match[4].replaceAll(/\s+/gu, '');
  if (hex.length % 2 !== 0) {
    return null;
  }
  return {
    usage: Number(match[1]),
    selector: Number(match[2]),
    matching: Number(match[3]),
    data: Buffer.from(hex, 'hex'),
  };
}

/** Digest lengths in bytes for the matching types that hash. */
const DIGEST_LENGTH: Record<number, number | undefined> = { 1: 32, 2: 64 };

/**
 * Returns what is wrong with the record's fields, or null when it is well
 * formed: unknown usage, selector or matching type, or a digest of the wrong
 * length.
 */
export function tlsaFieldProblem(record: TlsaRecord): string | null {
  if (record.usage < 0 || record.usage > 3) {
    return `unknown certificate usage ${record.usage}`;
  }
  if (record.selector !== 0 && record.selector !== 1) {
    return `unknown selector ${record.selector}`;
  }
  if (record.matching < 0 || record.matching > 2) {
    return `unknown matching type ${record.matching}`;
  }
  const expected = DIGEST_LENGTH[record.matching];
  if (expected !== undefined && record.data.length !== expected) {
    return `the digest is ${record.data.length} bytes, expected ${expected}`;
  }
  if (record.data.length === 0) {
    return 'the certificate association data is empty';
  }
  return null;
}

/**
 * True for the usages that receiving mail servers should publish: DANE-TA(2)
 * and DANE-EE(3). Internet.nl ignores PKIX-TA(0) and PKIX-EE(1) because they
 * must not be used for SMTP (RFC 7672).
 */
export const isDaneUsage = (record: TlsaRecord): boolean =>
  record.usage === 2 || record.usage === 3;

/** Computes the association data of a DER certificate for a record. */
function associate(record: TlsaRecord, der: Buffer): Buffer {
  const selected =
    record.selector === 0
      ? der
      : new X509Certificate(der).publicKey.export({
          type: 'spki',
          format: 'der',
        });
  if (record.matching === 0) {
    return Buffer.from(selected);
  }
  return createHash(record.matching === 1 ? 'sha256' : 'sha512')
    .update(selected)
    .digest();
}

/**
 * Checks a record against the certificate chain the server presented
 * (leaf first, DER encoded). DANE-EE(3) must match the leaf; DANE-TA(2)
 * matches any certificate of the chain. The PKIX usages are never accepted.
 */
export function tlsaMatches(record: TlsaRecord, chain: Buffer[]): boolean {
  if (tlsaFieldProblem(record) !== null || !isDaneUsage(record)) {
    return false;
  }
  const candidates = record.usage === 3 ? chain.slice(0, 1) : chain;
  return candidates.some((der) => {
    try {
      return associate(record, der).equals(record.data);
    } catch {
      return false;
    }
  });
}
