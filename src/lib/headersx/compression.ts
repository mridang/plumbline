/**
 * `Use-As-Dictionary` advertises that a response may be used as a compression
 * dictionary for future requests (Compression Dictionary Transport). It is an
 * RFC 8941 dictionary; the only required member is `match`, a quoted URL-
 * pattern string saying which requests the dictionary applies to. The check
 * validates the dictionary when the header is present, following the MDN page.
 */
import { finding, type Finding } from '../headers/finding.js';
import { dictionary } from './structured.js';

/** Keys the header defines; anything else is an unrecognised parameter. */
const KNOWN = new Set(['match', 'match-dest', 'id', 'type']);

/**
 * Validates a `Use-As-Dictionary` header value: it must parse as a dictionary
 * that includes a non-empty quoted `match` pattern. A missing or empty `match`
 * is reported because the browser cannot tell which requests the dictionary
 * serves, and an unrecognised key is reported as likely a mistake.
 */
export function compressionDictionaryFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  const members = dictionary(value);
  if (!members) {
    return [
      finding(
        'warning',
        'The \'Use-As-Dictionary\' header must be a dictionary with at least a match="url-pattern" member.',
      ),
    ];
  }
  const match = members.find((member) => member.key === 'match');
  const pattern = match ? /^"(.*)"$/.exec(match.value)?.[1] : undefined;
  if (!match || pattern === undefined || pattern.trim() === '') {
    return [
      finding(
        'warning',
        "The 'Use-As-Dictionary' header must include a non-empty quoted 'match' URL-pattern.",
      ),
    ];
  }
  const unknown = members
    .map((member) => member.key)
    .filter((key) => !KNOWN.has(key));
  return unknown.length > 0
    ? [
        finding(
          'warning',
          `The 'Use-As-Dictionary' header has unrecognised key(s): ${unknown.join(', ')}; use match, match-dest, id or type.`,
        ),
      ]
    : [];
}
