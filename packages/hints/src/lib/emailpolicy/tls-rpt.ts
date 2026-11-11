import type { TxtLookup } from '../email/txt.js';
import type { Finding } from './finding.js';

/**
 * SMTP TLS Reporting (TLS-RPT, RFC 8460) lets a domain ask sending servers to
 * send daily reports about the success and failure of TLS when delivering
 * mail to it. It is a single TXT record at `_smtp._tls.<domain>` of the form
 * `v=TLSRPTv1; rua=<uri>[,<uri>]`, where each `rua` URI is a `mailto:` address
 * or an `https:` endpoint the reports are sent to (RFC 8460 section 3).
 *
 * The function here is pure: the hint resolves the TXT record and hands it to
 * {@link checkTlsRpt}.
 */

/** Keeps only the TXT records that declare a TLS-RPT policy. */
function tlsRptRecords(txt: TxtLookup): string[] {
  if (txt.status !== 'ok') {
    return [];
  }
  return txt.records.filter((record) =>
    record.trim().toLowerCase().startsWith('v=tlsrpt'),
  );
}

/** Parses `tag=value; tag=value` pairs, lower-casing the tag names. */
function parseTags(record: string): Map<string, string> {
  const tags = new Map<string, string>();
  for (const part of record.split(';')) {
    const trimmed = part.trim();
    if (trimmed === '') {
      continue;
    }
    const equals = trimmed.indexOf('=');
    const key = (equals === -1 ? trimmed : trimmed.slice(0, equals))
      .trim()
      .toLowerCase();
    const value = equals === -1 ? '' : trimmed.slice(equals + 1).trim();
    if (!tags.has(key)) {
      tags.set(key, value);
    }
  }
  return tags;
}

/**
 * Checks that every destination in a `rua` value is a valid URI: a `mailto:`
 * address or an `https:` URL (RFC 8460 section 3). Returns the first invalid
 * destination, or null when all are valid. An empty list is itself invalid.
 */
function invalidRuaDestination(rua: string): string | null {
  const destinations = rua
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (destinations.length === 0) {
    return '';
  }
  for (const destination of destinations) {
    const lower = destination.toLowerCase();
    const isValid =
      (lower.startsWith('mailto:') && destination.includes('@')) ||
      lower.startsWith('https://');
    if (!isValid) {
      return destination;
    }
  }
  return null;
}

/**
 * Validates a domain's TLS-RPT setup from its `_smtp._tls` TXT lookup. A
 * failed lookup returns no findings. A domain with no record is reported once
 * as advice; a record that is duplicated or malformed is reported as an error.
 */
export function checkTlsRpt(domain: string, txt: TxtLookup): Finding[] {
  if (txt.status === 'error') {
    return [];
  }
  const records = tlsRptRecords(txt);

  if (records.length === 0) {
    return [
      {
        message:
          'Your domain does *not* publish a TLS-RPT record, so you receive no reports about failed TLS delivery of your mail.',
        severity: 'warning',
        codeSnippet: `_smtp._tls.${domain}. IN TXT "v=TLSRPTv1; rua=mailto:tlsrpt@${domain}"`,
      },
    ];
  }
  if (records.length > 1) {
    return [
      {
        message:
          'Your domain has *more than one* `_smtp._tls` TXT record; there must be exactly one.',
        severity: 'error',
        codeSnippet: records.join('\n'),
      },
    ];
  }

  const record = records[0];
  const tags = parseTags(record);
  // The version tag must come first and be exactly TLSRPTv1 (RFC 8460 3).
  if (tags.get('v') !== 'TLSRPTv1') {
    return [
      {
        message:
          'Your TLS-RPT record is *not* syntactically correct: it must start with `v=TLSRPTv1`.',
        severity: 'error',
        codeSnippet: record,
      },
    ];
  }
  const rua = tags.get('rua');
  if (rua === undefined || rua === '') {
    return [
      {
        message:
          'Your TLS-RPT record has *no* `rua` destination, so there is nowhere to send the reports.',
        severity: 'error',
        codeSnippet: record,
      },
    ];
  }
  const invalid = invalidRuaDestination(rua);
  if (invalid !== null) {
    return [
      {
        message:
          'Your TLS-RPT `rua` destination is *not* valid: each report address must be a `mailto:` or `https:` URI.',
        severity: 'error',
        codeSnippet: `rua=${rua}`,
      },
    ];
  }
  return [];
}
