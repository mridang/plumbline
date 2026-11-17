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
  if (offset < 0 || offset + 1 >= buffer.length) {
    throw new Error('Truncated DER data');
  }
  const tag = buffer[offset];
  const first = buffer[offset + 1];
  // Long form (high bit set): the low bits say how many length bytes follow.
  const count = first >= 0x80 ? first % 0x80 : 0;
  const start = offset + 2 + count;
  const length =
    first >= 0x80
      ? Array.from(
          { length: count },
          (_, index) => buffer[offset + 2 + index] ?? 0,
        ).reduce((total, byte) => total * 256 + byte, 0)
      : first;
  const end = start + length;
  if (end > buffer.length) {
    throw new Error('Truncated DER data');
  }
  return { tag, start, end };
}

/** Decodes the value of an OBJECT IDENTIFIER to its dotted form. */
function decodeOid(bytes: Buffer): string {
  const { parts } = [...bytes].reduce<{ parts: number[]; value: number }>(
    (state, byte) => {
      const value = state.value * 128 + (byte % 128);
      if (byte >= 128) {
        return { parts: state.parts, value };
      }
      if (state.parts.length === 0) {
        // The first number holds the first two arcs: 40 * first + second.
        const first = Math.min(Math.floor(value / 40), 2);
        return { parts: [first, value - first * 40], value: 0 };
      }
      return { parts: [...state.parts, value], value: 0 };
    },
    { parts: [], value: 0 },
  );
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
