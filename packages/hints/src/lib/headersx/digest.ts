/**
 * `Content-Digest` and `Repr-Digest` (RFC 9530) carry integrity digests of the
 * message content or representation. Both are RFC 8941 dictionaries mapping a
 * lower-case algorithm token to a byte-sequence digest, for example
 * `sha-256=:4REjxQ4yrqk=:`. The check validates the dictionary shape when the
 * header is present and warns when only an insecure algorithm is offered.
 */
import { finding, type Finding } from '../headers/finding.js';
import { dictionary } from './structured.js';

/** Algorithms the registry marks insecure; a digest in one of these is weak. */
const INSECURE = new Set(['md5', 'sha', 'unixsum', 'unixcksum']);

/** A byte-sequence value: base64 (or `*` padding) wrapped in colons. */
const BYTE_SEQUENCE = /^:[A-Za-z0-9+/=]*:(?:;.*)?$/;

/**
 * Validates a `Content-Digest` / `Repr-Digest` header value.
 *
 * @param name the header name, used in messages.
 * @param value the header value, or null when the header is absent.
 */
export function digestFindings(name: string, value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  const members = dictionary(value);
  if (!members) {
    return [
      finding(
        'warning',
        `The '${name}' header must be a dictionary of algorithm=:digest: members, for example 'sha-256=:...:'.`,
      ),
    ];
  }
  for (const member of members) {
    if (!BYTE_SEQUENCE.test(member.value)) {
      return [
        finding(
          'warning',
          `The '${member.key}' digest in '${name}' must be a byte sequence wrapped in colons, not '${member.value}'.`,
        ),
      ];
    }
  }
  // A response offering only an insecure algorithm gives attackers room to
  // forge a matching digest, so flag it when no modern algorithm is present.
  const secure = members.some((member) => !INSECURE.has(member.key));
  if (!secure) {
    return [
      finding(
        'warning',
        `The '${name}' header offers only insecure digest algorithms (${members
          .map((member) => member.key)
          .join(', ')}); include sha-256 or sha-512.`,
      ),
    ];
  }
  return [];
}
