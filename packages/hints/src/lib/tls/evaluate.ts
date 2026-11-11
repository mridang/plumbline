/**
 * Pure rating logic of the Internet.nl TLS test, ported from
 * `checks/tasks/tls/evaluation.py` and `scans.py` (Apache-2.0). Nothing
 * here opens a connection: the functions take what a probe found and say
 * how Internet.nl would rate it, so every rule is unit tested without TLS.
 */
import {
  CERT_CURVES_GOOD,
  CERT_EC_CURVES_GOOD,
  CERT_EC_CURVES_PHASE_OUT,
  CERT_RSA_MIN_GOOD_KEY_SIZE,
  CERT_RSA_MIN_PHASE_OUT_KEY_SIZE,
  CERT_SIGALG_KNOWN_BAD,
  CERT_SIGALG_PHASE_OUT,
  CERT_SIGALG_SUFFICIENT,
  CIPHERS_GOOD,
  CIPHERS_PHASE_OUT,
  CIPHERS_SUFFICIENT,
  FFDHE_PHASE_OUT_SIZES,
  FS_EC_GOOD,
  FS_EC_PHASE_OUT,
  MAX_SECURE_RENEG_ATTEMPTS,
  PROTOCOLS_GOOD,
  PROTOCOLS_PHASE_OUT,
  PROTOCOLS_SUFFICIENT,
  TLS_1_3_CIPHERS,
  TLS_1_3_PROBE_CIPHERS,
  type Rating,
  type TlsVersion,
} from './constants.js';

/** Items of one evaluation, grouped by their rating. */
export interface Grouped<T> {
  good: T[];
  sufficient: T[];
  phaseOut: T[];
  bad: T[];
}

const emptyGroups = <T>(): Grouped<T> => ({
  good: [],
  sufficient: [],
  phaseOut: [],
  bad: [],
});

/** Adds an item to the group for its rating. */
function addRated<T>(groups: Grouped<T>, rating: Rating, item: T): void {
  switch (rating) {
    case 'good': {
      groups.good.push(item);

      break;
    }
    case 'sufficient': {
      groups.sufficient.push(item);

      break;
    }
    case 'phase-out': {
      groups.phaseOut.push(item);

      break;
    }
    default: {
      groups.bad.push(item);
    }
  }
}

/** Rates a TLS version (NCSC 3.3.1). */
export function rateProtocol(version: TlsVersion): Rating {
  if (PROTOCOLS_GOOD.includes(version)) {
    return 'good';
  }
  if (PROTOCOLS_SUFFICIENT.includes(version)) {
    return 'sufficient';
  }
  if (PROTOCOLS_PHASE_OUT.includes(version)) {
    return 'phase-out';
  }
  return 'bad';
}

/** Groups the accepted TLS versions by rating. */
export function evaluateProtocols(
  accepted: readonly TlsVersion[],
): Grouped<TlsVersion> {
  const groups = emptyGroups<TlsVersion>();
  for (const version of accepted) {
    addRated(groups, rateProtocol(version), version);
  }
  return groups;
}

/**
 * Rates a cipher suite by its IANA name (for example
 * `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`). Anything that is not listed is
 * insufficient. Every TLS 1.3 suite is acceptable except the ones
 * Internet.nl probes for, which are insufficient.
 */
export function rateCipher(standardName: string): Rating {
  if (CIPHERS_GOOD.includes(standardName)) {
    return 'good';
  }
  if (CIPHERS_SUFFICIENT.includes(standardName)) {
    return 'sufficient';
  }
  if (CIPHERS_PHASE_OUT.includes(standardName)) {
    return 'phase-out';
  }
  if (
    TLS_1_3_CIPHERS.includes(standardName) &&
    !TLS_1_3_PROBE_CIPHERS.includes(standardName)
  ) {
    return 'sufficient';
  }
  return 'bad';
}

/** Groups accepted cipher suites (IANA names, duplicates dropped). */
export function evaluateCiphers(
  standardNames: readonly string[],
): Grouped<string> {
  const groups = emptyGroups<string>();
  for (const name of new Set(standardNames)) {
    addRated(groups, rateCipher(name), name);
  }
  return groups;
}

/** What `getEphemeralKeyInfo()` of a Node TLS socket returns. */
export interface EphemeralKey {
  type: 'DH' | 'ECDH';
  /** Bits of the DH prime, or of the curve. */
  size: number;
  /** Curve name, only for ECDH. */
  name?: string;
}

/** The rating of one key exchange parameter, with a label for messages. */
export interface RatedParameter {
  rating: 'good' | 'phase-out' | 'bad';
  label: string;
}

/**
 * Rates ephemeral key exchange parameters (NCSC 3.3.2.1 and 3.3.3.1).
 *
 * Internet.nl checks that a DH key uses generator 2 and one of the RFC 7919
 * primes. Node does not expose the prime, so a DH key of the size of an
 * RFC 7919 group (3072 bits or more) is rated phase out on the assumption
 * that a group that large is a standard one; smaller DH is insufficient.
 */
export function rateEphemeralKey(key: EphemeralKey): RatedParameter {
  if (key.type === 'ECDH') {
    const name = key.name ?? 'unknown';
    const label = `ECDH-${name}`;
    if (FS_EC_PHASE_OUT.includes(name)) {
      return { rating: 'phase-out', label };
    }
    return { rating: FS_EC_GOOD.includes(name) ? 'good' : 'bad', label };
  }
  const label = `DH-${key.size}`;
  return {
    rating: FFDHE_PHASE_OUT_SIZES.some((size) => key.size >= size)
      ? 'phase-out'
      : 'bad',
    label,
  };
}

/** The result of rating a set of key exchange parameters. */
export interface KexEvaluation {
  phaseOut: string[];
  bad: string[];
  maxDhSize: number | null;
  maxEcSize: number | null;
}

/** Evaluates the ephemeral keys of all accepted cipher suites. */
export function evaluateKex(keys: readonly EphemeralKey[]): KexEvaluation {
  const phaseOut = new Set<string>();
  const bad = new Set<string>();
  for (const key of keys) {
    const { rating, label } = rateEphemeralKey(key);
    if (rating === 'phase-out') {
      phaseOut.add(label);
    } else if (rating === 'bad') {
      bad.add(label);
    }
  }
  const sizes = (type: EphemeralKey['type']): number[] =>
    keys.filter((key) => key.type === type).map((key) => key.size);
  const max = (values: number[]): number | null =>
    values.length > 0 ? Math.max(...values) : null;
  return {
    phaseOut: [...phaseOut],
    bad: [...bad],
    maxDhSize: max(sizes('DH')),
    maxEcSize: max(sizes('ECDH')),
  };
}

/** A cipher suite as Node reports it. */
export interface CipherInfo {
  /** OpenSSL name, for example `ECDHE-RSA-AES128-GCM-SHA256`. */
  name: string;
  /** IANA name, for example `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`. */
  standardName: string;
}

/** The outcome of the cipher order test. */
export interface CipherOrderEvaluation {
  status: 'good' | 'bad' | 'na';
  /** When bad: the cipher the server chose, then the one it should prefer. */
  violation: [string, string] | null;
}

/**
 * Tests the server's cipher preference as Internet.nl does: for each
 * sufficient or good cipher the server accepts, offer all phase out
 * ciphers followed by that cipher. A server that enforces its own order
 * picks the better cipher; one that follows the client picks the first
 * (phase out) cipher. Within a level the order does not matter.
 *
 * The test does not apply when the server accepts nothing below
 * "sufficient" or only TLS 1.3 (`onlyTls13`), because TLS 1.3 suites are
 * all acceptable.
 * @param accepted - The cipher suites accepted below TLS 1.3.
 * @param choose - Connects offering the ciphers in order and returns the
 * cipher the server picked, or null when the connection failed.
 * @param onlyTls13 - True when the server accepts no version below TLS 1.3.
 */
export async function evaluateCipherOrder(
  accepted: readonly CipherInfo[],
  choose: (offered: readonly CipherInfo[]) => Promise<CipherInfo | null>,
  onlyTls13 = false,
): Promise<CipherOrderEvaluation> {
  const na: CipherOrderEvaluation = { status: 'na', violation: null };
  const phaseOut = accepted.filter(
    (c) => rateCipher(c.standardName) === 'phase-out',
  );
  const better = accepted.filter((c) => {
    const rating = rateCipher(c.standardName);
    return rating === 'good' || rating === 'sufficient';
  });
  const worse = accepted.some((c) => rateCipher(c.standardName) === 'bad');
  if (onlyTls13 || (!worse && phaseOut.length === 0)) {
    return na;
  }
  // Internet.nl sorts CHACHA last in case the server prioritizes it (#461).
  const lessPreferred = [...phaseOut].sort(
    (a, b) =>
      Number(a.standardName.includes('CHACHA')) -
      Number(b.standardName.includes('CHACHA')),
  );
  for (const expected of better) {
    if (lessPreferred.length === 0) {
      continue;
    }
    const picked = await choose([...lessPreferred, expected]);
    if (picked === null) {
      // The cipher was accepted before: treat an unusable test as n/a.
      return na;
    }
    if (picked.standardName !== expected.standardName) {
      return {
        status: 'bad',
        violation: [picked.standardName, expected.standardName],
      };
    }
  }
  return { status: 'good', violation: null };
}

/** The public key of a certificate, as read from X.509. */
export interface CertKey {
  /** `rsa`, `ec`, `ed25519`, `ed448`, `dsa`... */
  type: string;
  /** RSA modulus length in bits. */
  modulusLength?: number;
  /** EC curve, by OpenSSL name. */
  curve?: string;
}

/** The rating of a certificate key with a description for messages. */
export interface RatedKey {
  rating: 'good' | 'phase-out' | 'bad';
  description: string;
}

/** Rates a certificate public key (NCSC 3.3.2.1). */
export function rateCertificateKey(key: CertKey): RatedKey {
  const bits = key.modulusLength ? `-${key.modulusLength}` : '';
  const curve = key.curve ? `, curve: ${key.curve}` : '';
  const description = `${key.type.toUpperCase()}${bits}${curve}`;
  const good =
    (key.type === 'rsa' &&
      (key.modulusLength ?? 0) >= CERT_RSA_MIN_GOOD_KEY_SIZE) ||
    CERT_CURVES_GOOD.includes(key.type) ||
    (key.type === 'ec' &&
      key.curve !== undefined &&
      CERT_EC_CURVES_GOOD.includes(key.curve));
  if (good) {
    return { rating: 'good', description };
  }
  const phaseOut =
    (key.type === 'ec' &&
      key.curve !== undefined &&
      CERT_EC_CURVES_PHASE_OUT.includes(key.curve)) ||
    (key.type === 'rsa' &&
      (key.modulusLength ?? 0) >= CERT_RSA_MIN_PHASE_OUT_KEY_SIZE);
  return { rating: phaseOut ? 'phase-out' : 'bad', description };
}

/** The rating of a signature algorithm. */
export interface RatedSignature {
  rating: 'sufficient' | 'phase-out' | 'bad';
  /** Algorithm name when known, otherwise the dotted OID. */
  name: string;
}

/** Rates a certificate signature algorithm by its OID (NCSC 3.3.2, 3.3.5). */
export function rateSignatureAlgorithm(oid: string): RatedSignature {
  if (oid in CERT_SIGALG_SUFFICIENT) {
    return { rating: 'sufficient', name: CERT_SIGALG_SUFFICIENT[oid] };
  }
  if (oid in CERT_SIGALG_PHASE_OUT) {
    return { rating: 'phase-out', name: CERT_SIGALG_PHASE_OUT[oid] };
  }
  return { rating: 'bad', name: CERT_SIGALG_KNOWN_BAD[oid] ?? oid };
}

/** NCSC 3.4.2: how client-initiated renegotiation is rated. */
export type ClientRenegotiationStatus =
  'not-allowed' | 'allowed-with-low-limit' | 'allowed-with-too-high-limit';

/** Rates the number of client renegotiations the server accepted. */
export function rateClientRenegotiation(
  successCount: number,
): ClientRenegotiationStatus {
  if (successCount <= 0) {
    return 'not-allowed';
  }
  return successCount <= MAX_SECURE_RENEG_ATTEMPTS
    ? 'allowed-with-low-limit'
    : 'allowed-with-too-high-limit';
}

/** OCSP stapling status. */
export type OcspStatus = 'good' | 'ok' | 'not-in-cert';

/**
 * Rates OCSP stapling: it only applies when the certificate has an OCSP
 * pointer. Internet.nl also validates the stapled response; Node does not
 * expose that, so a stapled response counts as good.
 */
export function rateOcsp(
  hasOcspPointer: boolean,
  hasStapledResponse: boolean,
): OcspStatus {
  if (!hasOcspPointer) {
    return 'not-in-cert';
  }
  return hasStapledResponse ? 'good' : 'ok';
}

/** Formats a version the way Internet.nl does: `TLSv1.2` becomes `TLS 1.2`. */
export function formatVersion(version: TlsVersion): string {
  // Node calls TLS 1.0 plain `TLSv1`; Internet.nl names it `TLS 1.0`.
  return version === 'TLSv1' ? 'TLS 1.0' : version.replace('TLSv', 'TLS ');
}
