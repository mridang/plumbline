import type { DnsClient } from '../../core/dns.js';

/**
 * Matches one quoted character string: its body (a backslash escape `\X` or
 * `\DDD`, or any other character) up to an unescaped quote, and the quote.
 */
const QUOTED_STRING = /"((?:\\\d{3}|\\[\s\S]|[^"\\]|\\)*)"?/gu;

/** Matches the backslash escapes of a quoted string: `\DDD` or `\X`. */
const ESCAPE = /\\(\d{3}|[\s\S])/gu;

/** DNS record type number of a TXT record. */
const TXT = 16;

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
  return Array.from(trimmed.matchAll(QUOTED_STRING), (match) =>
    match[1].replaceAll(ESCAPE, (_, escaped: string) =>
      escaped.length === 3 ? String.fromCodePoint(Number(escaped)) : escaped,
    ),
  ).join('');
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
