import type { DnsClient } from '../../core/dns.js';

/** DNS record type number of a TXT record. */
const TXT = 16;

/**
 * Decodes the character at `index` of a quoted string, which is a backslash
 * escape (`\X` or `\DDD`) or a plain character. Returns the text and its width.
 */
function decodeChar(text: string, index: number): [string, number] {
  if (text[index] !== '\\' || index + 1 >= text.length) {
    return [text[index], 1];
  }
  const decimal = /^\d{3}/u.exec(text.slice(index + 1));
  if (decimal) {
    return [String.fromCodePoint(Number(decimal[0])), 4];
  }
  return [text[index + 1], 2];
}

/**
 * Turns the presentation form of a TXT record into its text. A record is one
 * or more quoted character strings that are concatenated without a
 * separator (RFC 7208 section 3.3); an unquoted value is returned as is.
 */
export function decodeTxt(data: string): string {
  const trimmed = data.trim();
  if (!trimmed.startsWith('"')) {
    return trimmed;
  }
  let result = '';
  let index = 0;
  while (index < trimmed.length) {
    if (trimmed[index] !== '"') {
      // Whitespace between the quoted strings.
      index += 1;
      continue;
    }
    index += 1;
    while (index < trimmed.length && trimmed[index] !== '"') {
      const [char, width] = decodeChar(trimmed, index);
      result += char;
      index += width;
    }
    // Skip the closing quote.
    index += 1;
  }
  return result;
}

/** The outcome of a TXT lookup, which the policy checks treat differently. */
export type TxtLookup =
  | { status: 'ok'; records: string[] }
  | { status: 'nxdomain' }
  | { status: 'error' };

/**
 * Looks up the TXT records of a name. `nxdomain` means the name does not
 * exist, `error` means the lookup failed (timeout, SERVFAIL, network).
 */
export async function lookupTxt(
  client: DnsClient,
  name: string,
): Promise<TxtLookup> {
  try {
    const response = await client.query(name, 'TXT');
    if (response.status === 3) {
      return { status: 'nxdomain' };
    }
    if (response.status !== 0) {
      return { status: 'error' };
    }
    return {
      status: 'ok',
      records: response.answers
        .filter((record) => record.type === TXT)
        .map((record) => decodeTxt(record.data)),
    };
  } catch {
    return { status: 'error' };
  }
}
