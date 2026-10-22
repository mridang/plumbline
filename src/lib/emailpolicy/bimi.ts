import type { TxtLookup } from '../email/txt.js';
import type { Finding } from './finding.js';

/**
 * BIMI (Brand Indicators for Message Identification) lets a domain publish the
 * logo mail clients show next to authenticated mail. It is a TXT record at
 * `<selector>._bimi.<domain>` (the default selector is `default`) of the form
 * `v=BIMI1; l=<https svg url>; a=<https vmc pem url>` (BIMI draft section 4):
 *
 * - `l` is the HTTPS URL of the logo, which must be an SVG Tiny Portable/Secure
 *   file. It may be empty, together with an empty `a`, to signal that the
 *   domain explicitly declines to participate.
 * - `a` is optional and, when present, the HTTPS URL of the Verified Mark
 *   Certificate (a PEM file) that vouches for the logo.
 *
 * BIMI is only honoured when the domain already enforces DMARC (a policy of
 * `quarantine` or `reject`), so a valid record carries that reminder as a
 * note. The function here is pure; the hint resolves the TXT record.
 */

/** The default BIMI selector; the record lives at `default._bimi.<domain>`. */
export const DEFAULT_SELECTOR = 'default';

/** Keeps only the TXT records that declare a BIMI assertion. */
function bimiRecords(txt: TxtLookup): string[] {
  if (txt.status !== 'ok') {
    return [];
  }
  return txt.records.filter((record) =>
    record.trim().toLowerCase().startsWith('v=bimi'),
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
 * Validates a domain's BIMI record from its `default._bimi` TXT lookup. A
 * failed lookup returns no findings. A domain with no record is reported once
 * as advice; a malformed record, a non-HTTPS or non-SVG logo, or a non-HTTPS
 * certificate are errors. A valid record carries a note that DMARC must be
 * enforced for the logo to be shown.
 */
export function checkBimi(domain: string, txt: TxtLookup): Finding[] {
  if (txt.status === 'error') {
    return [];
  }
  const records = bimiRecords(txt);

  if (records.length === 0) {
    return [
      {
        message:
          'Your domain does *not* publish a BIMI record, so mail clients cannot show your verified logo.',
        severity: 'warning',
        codeSnippet: `${DEFAULT_SELECTOR}._bimi.${domain}. IN TXT "v=BIMI1; l=https://${domain}/logo.svg"`,
      },
    ];
  }
  if (records.length > 1) {
    return [
      {
        message:
          'Your domain has *more than one* `default._bimi` TXT record; there must be exactly one.',
        severity: 'error',
        codeSnippet: records.join('\n'),
      },
    ];
  }

  const record = records[0];
  const tags = parseTags(record);
  // The version tag must come first and be exactly BIMI1 (BIMI draft 4.4).
  if (tags.get('v') !== 'BIMI1') {
    return [
      {
        message:
          'Your BIMI record is *not* syntactically correct: it must start with `v=BIMI1`.',
        severity: 'error',
        codeSnippet: record,
      },
    ];
  }

  const logo = tags.get('l') ?? '';
  const authority = tags.get('a') ?? '';
  const findings: Finding[] = [];

  if (logo === '' && authority === '') {
    // An empty `l` with an empty `a` is a valid declination to participate.
    return [
      {
        message:
          'Your BIMI record is a valid declination (empty `l` and `a`); publish an SVG logo URL in `l` to show a logo.',
        severity: 'hint',
        codeSnippet: record,
      },
    ];
  }

  if (logo === '') {
    findings.push({
      message:
        'Your BIMI record has *no* `l` logo URL, so there is no image for mail clients to show.',
      severity: 'error',
      codeSnippet: record,
    });
  } else if (!/^https:\/\//iu.test(logo)) {
    findings.push({
      message: 'Your BIMI `l` logo URL must be served over `https:`.',
      severity: 'error',
      codeSnippet: `l=${logo}`,
    });
  } else if (!/\.svg(\?|#|$)/iu.test(logo)) {
    findings.push({
      message:
        'Your BIMI `l` logo URL must point to an SVG file (an SVG Tiny Portable/Secure logo).',
      severity: 'error',
      codeSnippet: `l=${logo}`,
    });
  }

  if (authority !== '' && !/^https:\/\//iu.test(authority)) {
    findings.push({
      message: 'Your BIMI `a` certificate URL must be served over `https:`.',
      severity: 'error',
      codeSnippet: `a=${authority}`,
    });
  }

  // When the record itself is well formed, remind that DMARC enforcement is a
  // prerequisite for the logo to ever be displayed.
  if (findings.length === 0) {
    findings.push({
      message:
        'Your BIMI record is valid; note that your domain must also enforce DMARC (`p=quarantine` or `p=reject`) for the logo to be shown.',
      severity: 'hint',
      codeSnippet: record,
    });
  }
  return findings;
}
