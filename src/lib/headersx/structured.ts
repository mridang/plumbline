/**
 * Small parsing helpers shared by the experimental-header checks in this
 * folder. They cover just enough of RFC 8941 (Structured Field Values) to let
 * each check validate the one shape its header uses — a dictionary, a list or a
 * token list — without pulling in a full structured-field parser.
 */

/**
 * Splits a structured-field value into its top-level members at commas that
 * are outside quoted strings and outside `:...:` byte-sequence delimiters.
 * Returns the trimmed, non-empty members, or null when the value is empty.
 */
export function topLevelMembers(value: string): string[] | null {
  const members: string[] = [];
  let current = '';
  let inQuotes = false;
  let inBytes = false;
  for (const char of value) {
    if (char === '"' && !inBytes) {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === ':' && !inQuotes) {
      inBytes = !inBytes;
      current += char;
    } else if (char === ',' && !inQuotes && !inBytes) {
      members.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  members.push(current);
  const trimmed = members.map((member) => member.trim()).filter(Boolean);
  return trimmed.length > 0 ? trimmed : null;
}

/** One `key=value` (or bare `key`) member of a structured dictionary. */
export interface DictionaryMember {
  key: string;
  /** The raw value text, trimmed; empty string for a bare key. */
  value: string;
}

/** A dictionary key: a structured-field token key (lower-case preferred). */
const KEY = /^[a-z*][a-z0-9_.*-]*$/i;

/**
 * Parses a structured dictionary into its members, preserving order. Returns
 * null when the value is empty or a member has a malformed key, so a caller can
 * report the header as invalid rather than silently accept it.
 */
export function dictionary(value: string): DictionaryMember[] | null {
  const members = topLevelMembers(value);
  if (!members) {
    return null;
  }
  const parsed: DictionaryMember[] = [];
  for (const member of members) {
    const equals = member.indexOf('=');
    const key = (equals === -1 ? member : member.slice(0, equals)).trim();
    const raw = equals === -1 ? '' : member.slice(equals + 1).trim();
    if (!KEY.test(key)) {
      return null;
    }
    parsed.push({ key: key.toLowerCase(), value: raw });
  }
  return parsed;
}

/** A structured-field token. */
const TOKEN = /^[A-Za-z*][A-Za-z0-9:/!#$%&'*+.^_`|~-]*$/;

/**
 * Splits a comma-separated token list and returns the trimmed tokens, or null
 * when any member is not a valid token.
 */
export function tokenList(value: string): string[] | null {
  const tokens = value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  return tokens.every((token) => TOKEN.test(token)) ? tokens : null;
}
