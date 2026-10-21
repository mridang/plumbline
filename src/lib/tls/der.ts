/**
 * A minimal DER reader that finds the signature algorithm of a certificate.
 * Node's `X509Certificate` does not expose it, and the package may not
 * depend on a native or third party parser.
 */

interface Tlv {
  tag: number;
  /** Offset of the value. */
  start: number;
  /** Offset just past the value. */
  end: number;
}

/** Reads one tag-length-value header at `offset`. */
function readTlv(buffer: Buffer, offset: number): Tlv {
  const tag = buffer[offset];
  let length = buffer[offset + 1];
  let start = offset + 2;
  if (length === undefined || tag === undefined) {
    throw new Error('Truncated DER data');
  }
  if (length & 0x80) {
    // Long form: the low bits say how many length bytes follow.
    const count = length & 0x7f;
    length = 0;
    for (let i = 0; i < count; i++) {
      length = length * 256 + (buffer[start + i] ?? 0);
    }
    start += count;
  }
  const end = start + length;
  if (end > buffer.length) {
    throw new Error('Truncated DER data');
  }
  return { tag, start, end };
}

/** Decodes the value of an OBJECT IDENTIFIER to its dotted form. */
function decodeOid(bytes: Buffer): string {
  const parts: number[] = [];
  let value = 0;
  for (const byte of bytes) {
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) {
      if (parts.length === 0) {
        // The first number holds the first two arcs: 40 * first + second.
        const first = Math.min(Math.floor(value / 40), 2);
        parts.push(first, value - first * 40);
      } else {
        parts.push(value);
      }
      value = 0;
    }
  }
  return parts.join('.');
}

/**
 * Returns the OID of the outer `signatureAlgorithm` of a DER certificate:
 * `Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, ... }`.
 * Throws when the data is not a certificate.
 */
export function signatureAlgorithmOid(der: Buffer): string {
  const certificate = readTlv(der, 0);
  if (certificate.tag !== 0x30) {
    throw new Error('Not a DER certificate');
  }
  const tbs = readTlv(der, certificate.start);
  const algorithm = readTlv(der, tbs.end);
  if (algorithm.tag !== 0x30) {
    throw new Error('No signatureAlgorithm in certificate');
  }
  const oid = readTlv(der, algorithm.start);
  if (oid.tag !== 0x06) {
    throw new Error('No algorithm identifier in certificate');
  }
  return decodeOid(der.subarray(oid.start, oid.end));
}
