/**
 * The rating lists of the Internet.nl TLS test, ported as data from
 * `checks/tasks/tls/tls_constants.py` (Apache-2.0,
 * https://github.com/internetstandards/Internet.nl). Internet.nl derives
 * them from the Dutch NCSC "IT Security Guidelines for Transport Layer
 * Security", the section numbers are kept in the comments.
 *
 * Anything that is not in a "good", "sufficient" or "phase out" list is
 * insufficient ("bad").
 */

/** How a single value is rated. `phase-out` is advice, `bad` a failure. */
export type Rating = 'good' | 'sufficient' | 'phase-out' | 'bad';

/** TLS versions in the order they are probed. */
export const TLS_VERSIONS = ['TLSv1.3', 'TLSv1.2', 'TLSv1.1', 'TLSv1'] as const;

export type TlsVersion = (typeof TLS_VERSIONS)[number];

/** NCSC 3.3.1 */
export const PROTOCOLS_GOOD: readonly TlsVersion[] = ['TLSv1.3'];
export const PROTOCOLS_SUFFICIENT: readonly TlsVersion[] = ['TLSv1.2'];
export const PROTOCOLS_PHASE_OUT: readonly TlsVersion[] = [];

/** NCSC appendix B, derived from 3.3.3 and 3.3.4. */
export const CIPHERS_GOOD: readonly string[] = [
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256',
];

export const CIPHERS_SUFFICIENT: readonly string[] = [
  'TLS_AES_128_GCM_SHA256',
  'TLS_AES_128_CCM_SHA256',
  'TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256',
  'TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384',
  'TLS_ECDHE_ECDSA_WITH_AES_256_CCM',
  'TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256',
  'TLS_ECDHE_ECDSA_WITH_AES_128_CCM',
  'TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256',
  'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
  'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
];

export const CIPHERS_PHASE_OUT: readonly string[] = [
  'TLS_ECDHE_ECDSA_WITH_CAMELLIA_256_GCM_SHA384',
  'TLS_ECDHE_ECDSA_WITH_CAMELLIA_256_CBC_SHA384',
  'TLS_ECDHE_ECDSA_WITH_CAMELLIA_128_GCM_SHA256',
  'TLS_ECDHE_ECDSA_WITH_CAMELLIA_128_CBC_SHA256',
  'TLS_ECDHE_ECDSA_WITH_ARIA_256_GCM_SHA384',
  'TLS_ECDHE_ECDSA_WITH_ARIA_256_CBC_SHA384',
  'TLS_ECDHE_ECDSA_WITH_ARIA_128_GCM_SHA256',
  'TLS_ECDHE_ECDSA_WITH_ARIA_128_CBC_SHA256',
  'TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA384',
  'TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256',
  'TLS_ECDHE_RSA_WITH_CAMELLIA_256_GCM_SHA384',
  'TLS_ECDHE_RSA_WITH_CAMELLIA_256_CBC_SHA384',
  'TLS_ECDHE_RSA_WITH_CAMELLIA_128_GCM_SHA256',
  'TLS_ECDHE_RSA_WITH_CAMELLIA_128_CBC_SHA256',
  'TLS_ECDHE_RSA_WITH_ARIA_256_GCM_SHA384',
  'TLS_ECDHE_RSA_WITH_ARIA_256_CBC_SHA384',
  'TLS_ECDHE_RSA_WITH_ARIA_128_GCM_SHA256',
  'TLS_ECDHE_RSA_WITH_ARIA_128_CBC_SHA256',
  'TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA384',
  'TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256',
  'TLS_DHE_RSA_WITH_CHACHA20_POLY1305_SHA256',
  'TLS_DHE_RSA_WITH_CAMELLIA_256_GCM_SHA384',
  'TLS_DHE_RSA_WITH_CAMELLIA_256_CBC_SHA256',
  'TLS_DHE_RSA_WITH_CAMELLIA_128_GCM_SHA256',
  'TLS_DHE_RSA_WITH_CAMELLIA_128_CBC_SHA256',
  'TLS_DHE_RSA_WITH_ARIA_256_GCM_SHA384',
  'TLS_DHE_RSA_WITH_ARIA_256_CBC_SHA384',
  'TLS_DHE_RSA_WITH_ARIA_128_GCM_SHA256',
  'TLS_DHE_RSA_WITH_ARIA_128_CBC_SHA256',
  'TLS_DHE_RSA_WITH_AES_256_GCM_SHA384',
  'TLS_DHE_RSA_WITH_AES_256_CCM',
  'TLS_DHE_RSA_WITH_AES_256_CBC_SHA256',
  'TLS_DHE_RSA_WITH_AES_128_GCM_SHA256',
  'TLS_DHE_RSA_WITH_AES_128_CCM',
  'TLS_DHE_RSA_WITH_AES_128_CBC_SHA256',
];

/**
 * The TLS 1.3 suites. Internet.nl rates every TLS 1.3 suite as good or
 * sufficient except the one it probes for (`TLS_1_3_PROBE_CIPHERS`).
 */
export const TLS_1_3_CIPHERS: readonly string[] = [
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256',
  'TLS_AES_128_GCM_SHA256',
  'TLS_AES_128_CCM_SHA256',
  'TLS_AES_128_CCM_8_SHA256',
];

/** The only TLS 1.3 suite that is insufficient (#2078, #2050, #2031). */
export const TLS_1_3_PROBE_CIPHERS: readonly string[] = [
  'TLS_AES_128_CCM_8_SHA256',
];

/** NCSC 3.3.2 / 3.3.5, as the dotted object identifiers of the algorithms. */
export const CERT_SIGALG_SUFFICIENT: Readonly<Record<string, string>> = {
  '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption',
  '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
  '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption',
  '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256',
  '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
  '1.2.840.10045.4.3.4': 'ecdsa-with-SHA512',
  '1.3.101.112': 'ED25519',
  '1.3.101.113': 'ED448',
};

export const CERT_SIGALG_PHASE_OUT: Readonly<Record<string, string>> = {
  '1.2.840.113549.1.1.14': 'sha224WithRSAEncryption',
  '1.2.840.10045.4.3.1': 'ecdsa-with-SHA224',
};

/** Names of algorithms that are known but insufficient, for messages. */
export const CERT_SIGALG_KNOWN_BAD: Readonly<Record<string, string>> = {
  '1.2.840.113549.1.1.4': 'md5WithRSAEncryption',
  '1.2.840.113549.1.1.5': 'sha1WithRSAEncryption',
  '1.2.840.113549.1.1.10': 'rsassaPss',
  '1.2.840.10045.4.1': 'ecdsa-with-SHA1',
  '1.2.840.10040.4.3': 'dsa-with-sha1',
};

/** NCSC 3.3.2.1 */
export const CERT_RSA_MIN_GOOD_KEY_SIZE = 3072;
export const CERT_RSA_MIN_PHASE_OUT_KEY_SIZE = 2048;

/**
 * NCSC 3.3.2.1. Ed25519 and Ed448 keys are always good; Internet.nl notes
 * that no standard allows insufficient curves with EdDSA.
 */
export const CERT_CURVES_GOOD: readonly string[] = ['ed25519', 'ed448'];

/** Certificate key curves, by their OpenSSL (short) names. */
export const CERT_EC_CURVES_GOOD: readonly string[] = [
  'secp521r1',
  'secp384r1',
  'prime256v1',
  'brainpoolP512r1',
  'brainpoolP384r1',
  'brainpoolP256r1',
];
export const CERT_EC_CURVES_PHASE_OUT: readonly string[] = ['secp224r1'];

/**
 * NCSC 3.3.2.1: curves for ephemeral key exchange, by the names Node
 * reports in `getEphemeralKeyInfo()`. `secp256r1` is the same curve as
 * `prime256v1`.
 */
export const FS_EC_GOOD: readonly string[] = [
  'secp521r1',
  'secp384r1',
  'prime256v1',
  'secp256r1',
  'brainpoolP512r1',
  'brainpoolP384r1',
  'brainpoolP256r1',
  'X25519',
  'X448',
];
export const FS_EC_PHASE_OUT: readonly string[] = ['secp224r1'];

/**
 * NCSC 3.3.3.1: finite field DH is only acceptable (as phase out) when it
 * uses one of the RFC 7919 groups, with these sizes in bits.
 */
export const FFDHE_PHASE_OUT_SIZES: readonly number[] = [
  3072, 4096, 6144, 8192,
];

/**
 * NCSC 3.3.5: hash functions in the signature of the key exchange, as the
 * OpenSSL `sigalgs` strings used to offer only that hash. SHA-1 is bad,
 * SHA-224 is phase out. MD5 and SHA-1 with RSA-PSS are not offered because
 * OpenSSL does not support them.
 */
export const SIGNATURE_ALGORITHMS_BAD_HASH = 'RSA+SHA1:ECDSA+SHA1';
export const SIGNATURE_ALGORITHMS_PHASE_OUT_HASH = 'RSA+SHA224:ECDSA+SHA224';

/** NCSC 3.4.2: how many client renegotiations count as "limited". */
export const MAX_SECURE_RENEG_ATTEMPTS = 10;
/** The number of renegotiations the scan attempts. */
export const SCAN_RENEGOTIATION_LIMIT = MAX_SECURE_RENEG_ATTEMPTS + 1;
