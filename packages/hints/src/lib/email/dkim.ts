import { createPublicKey } from '#crypto';

/** Matches a `tag=value` pair and captures both parts. */
const TAG_VALUE_PAIR = /^([A-Za-z]\w*)\s*=([\s\S]*)$/u;

/** Matches a colon-separated list of hash algorithm names. */
const HASH_ALGORITHM_LIST = /^[A-Za-z0-9]+(?:\s*:\s*[A-Za-z0-9]+)*$/u;

/** Matches a wildcard or a colon-separated list of service types. */
const SERVICE_TYPE_LIST = /^(?:\*|[A-Za-z0-9-]+(?:\s*:\s*[A-Za-z0-9-]+)*)$/u;

/** Matches a colon-separated list of flags. */
const FLAG_LIST = /^[A-Za-z0-9-]*(?:\s*:\s*[A-Za-z0-9-]+)*$/u;

/**
 * A validator for DKIM key records (RFC 6376 section 3.6.1), the TXT record
 * published at `<selector>._domainkey.<domain>`. Internet.nl only checks
 * that `_domainkey.<domain>` exists because it cannot know the selectors;
 * when selectors are known the record behind each one can be checked.
 */

export interface DkimRecord {
  /** True when the record is syntactically valid and usable. */
  valid: boolean;
  /** True when `p=` is empty, which revokes the key. */
  revoked: boolean;
  /** True when the `t=` flags contain `y`: the domain is testing DKIM. */
  testing: boolean;
  keyType: 'rsa' | 'ed25519' | null;
  /** What is wrong with the record, empty when it is valid. */
  errors: string[];
}

/** Smallest RSA key a verifier may accept (RFC 8301). */
const MIN_RSA_BITS = 1024;

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/u;

/** Checks the public key in `p=` and returns what is wrong with it. */
function checkKey(keyType: 'rsa' | 'ed25519', base64: string): string | null {
  if (!BASE64.test(base64) || base64.length % 4 !== 0) {
    return "The 'p' tag is not valid base64.";
  }
  const der = Buffer.from(base64, 'base64');
  if (keyType === 'ed25519') {
    // RFC 8463: the raw 32 byte public key.
    return der.length === 32
      ? null
      : "The 'p' tag of an ed25519 key must be 32 bytes.";
  }
  try {
    const key = createPublicKey({ key: der, format: 'der', type: 'spki' });
    const bits = key.asymmetricKeyDetails?.modulusLength ?? 0;
    if (key.asymmetricKeyType !== 'rsa') {
      return "The 'p' tag does not hold an RSA public key.";
    }
    if (bits < MIN_RSA_BITS) {
      return `The RSA key has ${bits} bits; at least ${MIN_RSA_BITS} are required.`;
    }
    return null;
  } catch {
    return "The 'p' tag does not hold a valid RSA public key.";
  }
}

/** Parses and validates one DKIM key record. */
export function parseDkim(record: string): DkimRecord {
  const pieces = record.split(';').map((piece) => piece.trim());
  // A tag-list may end in a semicolon.
  const tagPieces = pieces.at(-1) === '' ? pieces.slice(0, -1) : pieces;
  const pairs = tagPieces.map((piece) => TAG_VALUE_PAIR.exec(piece));
  const tagErrors = tagPieces.flatMap((piece, index) => {
    const match = pairs[index];
    if (!match) {
      return [`'${piece}' is not a tag=value pair.`];
    }
    if (pairs.slice(0, index).some((earlier) => earlier?.[1] === match[1])) {
      return [`The '${match[1]}' tag appears more than once.`];
    }
    return match[1] === 'v' && index !== 0
      ? ["The 'v' tag must come first."]
      : [];
  });
  // Unknown tags are ignored by verifiers, so they are not an error. A
  // repeated tag keeps its first value.
  const tags = new Map(
    pairs.flatMap((match, index): [string, string][] =>
      match &&
      !pairs.slice(0, index).some((earlier) => earlier?.[1] === match[1])
        ? [[match[1], match[2].trim()]]
        : [],
    ),
  );

  const version = tags.get('v');
  const kind = (tags.get('k') ?? 'rsa').toLowerCase();
  const keyType = kind === 'rsa' || kind === 'ed25519' ? kind : null;
  const key = tags.get('p');
  // Whitespace inside the base64 is folding and is ignored; an unsupported
  // key type is already reported.
  const keyProblem =
    key !== undefined && key !== '' && keyType
      ? checkKey(keyType, key.replaceAll(/\s+/gu, ''))
      : null;
  const hashes = tags.get('h');
  const services = tags.get('s');
  const flags = tags.get('t');
  const flagsValid = flags !== undefined && FLAG_LIST.test(flags);

  const errors = [
    ...tagErrors,
    version !== undefined &&
      version !== 'DKIM1' &&
      "The 'v' tag must be 'DKIM1'.",
    keyType === null && `The key type '${kind}' is not supported.`,
    key === undefined && "The required 'p' tag is missing.",
    // An empty key revokes the selector.
    key === '' && 'The key is revoked: the p tag is empty.',
    keyProblem,
    hashes !== undefined &&
      !HASH_ALGORITHM_LIST.test(hashes) &&
      "The 'h' tag must be a colon separated list of hash names.",
    services !== undefined &&
      !SERVICE_TYPE_LIST.test(services) &&
      "The 's' tag must be '*' or a colon separated list of services.",
    flags !== undefined &&
      !flagsValid &&
      "The 't' tag must be a colon separated list of flags.",
  ].filter((error) => typeof error === 'string');

  return {
    valid: errors.length === 0,
    revoked: key === '',
    testing:
      flagsValid &&
      flags
        .split(':')
        .map((flag) => flag.trim().toLowerCase())
        .includes('y'),
    keyType,
    errors,
  };
}
