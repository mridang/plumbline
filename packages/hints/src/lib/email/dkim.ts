import { createPublicKey } from '#crypto';

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
  const errors: string[] = [];
  const result: DkimRecord = {
    valid: false,
    revoked: false,
    testing: false,
    keyType: null,
    errors,
  };

  const pieces = record.split(';').map((piece) => piece.trim());
  // A tag-list may end in a semicolon.
  if (pieces[pieces.length - 1] === '') {
    pieces.pop();
  }
  const tags = new Map<string, string>();
  for (const [index, piece] of pieces.entries()) {
    const match = /^([A-Za-z][A-Za-z0-9_]*)\s*=\s*([\s\S]*)$/u.exec(piece);
    if (!match) {
      errors.push(`'${piece}' is not a tag=value pair.`);
      continue;
    }
    const name = match[1];
    if (tags.has(name)) {
      errors.push(`The '${name}' tag appears more than once.`);
      continue;
    }
    if (name === 'v' && index !== 0) {
      errors.push("The 'v' tag must come first.");
    }
    tags.set(name, match[2].trim());
  }
  // Unknown tags are ignored by verifiers, so they are not an error.

  const version = tags.get('v');
  if (version !== undefined && version !== 'DKIM1') {
    errors.push("The 'v' tag must be 'DKIM1'.");
  }

  const kind = (tags.get('k') ?? 'rsa').toLowerCase();
  if (kind === 'rsa' || kind === 'ed25519') {
    result.keyType = kind;
  } else {
    errors.push(`The key type '${kind}' is not supported.`);
  }

  const key = tags.get('p');
  if (key === undefined) {
    errors.push("The required 'p' tag is missing.");
  } else if (key === '') {
    // An empty key revokes the selector.
    result.revoked = true;
    errors.push('The key is revoked: the p tag is empty.');
  } else if (result.keyType) {
    // Whitespace inside the base64 is folding and is ignored.
    const problem = checkKey(result.keyType, key.replace(/\s+/gu, ''));
    if (problem) {
      errors.push(problem);
    }
  }

  const hashes = tags.get('h');
  if (
    hashes !== undefined &&
    !/^[A-Za-z0-9]+(?:\s*:\s*[A-Za-z0-9]+)*$/u.test(hashes)
  ) {
    errors.push("The 'h' tag must be a colon separated list of hash names.");
  }
  const services = tags.get('s');
  if (
    services !== undefined &&
    !/^(?:\*|[A-Za-z0-9-]+(?:\s*:\s*[A-Za-z0-9-]+)*)$/u.test(services)
  ) {
    errors.push(
      "The 's' tag must be '*' or a colon separated list of services.",
    );
  }
  const flags = tags.get('t');
  if (flags !== undefined) {
    if (!/^[A-Za-z0-9-]*(?:\s*:\s*[A-Za-z0-9-]+)*$/u.test(flags)) {
      errors.push("The 't' tag must be a colon separated list of flags.");
    } else {
      result.testing = flags
        .split(':')
        .map((flag) => flag.trim().toLowerCase())
        .includes('y');
    }
  }

  result.valid = errors.length === 0;
  return result;
}
