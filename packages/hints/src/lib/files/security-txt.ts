import { isAbsoluteUrl, splitLines, type FileIssue } from './issue.js';

const RFC3339 =
  /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;
const LANG_TAG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const YEAR_MS = 366 * 24 * 3600 * 1000;

export interface SecurityTxtOptions {
  /** The URL the file was served from, to check `Canonical` against. */
  url?: string;
  /** The current time; injectable for tests. */
  now?: Date;
}

/** Web URI fields and the schemes RFC 9116 allows for each. */
const URI_FIELDS: Record<string, readonly string[]> = {
  contact: ['https', 'mailto', 'tel'],
  encryption: ['https', 'openpgp4fpr', 'dns'],
  policy: ['https'],
  acknowledgments: ['https'],
  hiring: ['https'],
  csaf: ['https'],
  canonical: ['https'],
};

/** Removes the OpenPGP clearsign envelope; returns null on a broken one. */
function stripSignature(
  lines: string[],
  issues: FileIssue[],
): { body: string[]; offset: number } {
  if (!lines[0]?.startsWith('-----BEGIN PGP SIGNED MESSAGE-----')) {
    return { body: lines, offset: 0 };
  }
  const blank = lines.findIndex((l, i) => i > 0 && l.trim() === '');
  const sig = lines.findIndex((l) =>
    l.startsWith('-----BEGIN PGP SIGNATURE-----'),
  );
  if (blank === -1 || sig === -1) {
    issues.push({
      severity: 'error',
      line: 1,
      message: 'The PGP clearsigned message is malformed.',
    });
    return { body: lines, offset: 0 };
  }
  if (!lines.some((l) => l.startsWith('-----END PGP SIGNATURE-----'))) {
    issues.push({
      severity: 'error',
      line: sig + 1,
      message: 'The PGP signature block is not terminated.',
    });
  }
  return { body: lines.slice(blank + 1, sig), offset: blank + 1 };
}

/** Validates the text of a security.txt file against RFC 9116. */
export function validateSecurityTxt(
  text: string,
  options: SecurityTxtOptions = {},
): FileIssue[] {
  const issues: FileIssue[] = [];
  const now = options.now ?? new Date();
  // Internet.nl only reads the first 100 KiB of the file.
  if (Buffer.byteLength(text, 'utf8') > 100 * 1024) {
    issues.push({
      severity: 'warning',
      message: 'The file is larger than 100 KiB; checkers may ignore the rest.',
    });
  }
  const { body, offset } = stripSignature(splitLines(text), issues);
  const fields: Record<string, { value: string; line: number }[]> = {};

  body.forEach((raw, i) => {
    const line = i + offset + 1;
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      return;
    }
    const colon = trimmed.indexOf(':');
    if (colon < 1) {
      issues.push({
        severity: 'error',
        line,
        snippet: trimmed,
        message: "Invalid line, expected 'Field: value'.",
      });
      return;
    }
    const name = trimmed.slice(0, colon).trim().toLowerCase();
    // Dash-escaped lines in signed files start with "- ".
    const value = trimmed.slice(colon + 1).trim();
    (fields[name] ??= []).push({ value, line });
  });

  for (const required of ['contact', 'expires']) {
    if (!fields[required]) {
      issues.push({
        severity: 'error',
        message: `The required '${required === 'contact' ? 'Contact' : 'Expires'}' field is missing.`,
      });
    }
  }

  const expires = fields['expires'] ?? [];
  if (expires.length > 1) {
    issues.push({
      severity: 'error',
      line: expires[1].line,
      snippet: `Expires: ${expires[1].value}`,
      message: "The 'Expires' field must appear only once.",
    });
  }
  if (expires[0]) {
    const { value, line } = expires[0];
    const snippet = `Expires: ${value}`;
    const time = RFC3339.test(value) ? Date.parse(value) : Number.NaN;
    if (Number.isNaN(time)) {
      issues.push({
        severity: 'error',
        line,
        snippet,
        message: "'Expires' must be an RFC 3339 date-time.",
      });
    } else if (time < now.getTime()) {
      issues.push({
        severity: 'error',
        line,
        snippet,
        message: 'The file has expired.',
      });
    } else if (time - now.getTime() > YEAR_MS) {
      issues.push({
        severity: 'warning',
        line,
        snippet,
        message: "'Expires' should be less than one year in the future.",
      });
    }
  }

  for (const [field, schemes] of Object.entries(URI_FIELDS)) {
    for (const { value, line } of fields[field] ?? []) {
      const snippet = `${field[0].toUpperCase()}${field.slice(1)}: ${value}`;
      let scheme = '';
      try {
        scheme = new URL(value).protocol.replace(/:$/, '');
      } catch {
        issues.push({
          severity: 'error',
          line,
          snippet,
          message: `'${value}' is not a valid URI.`,
        });
        continue;
      }
      if (scheme === 'http') {
        issues.push({
          severity: 'error',
          line,
          snippet,
          message: 'Web URIs must use HTTPS.',
        });
      } else if (!schemes.includes(scheme)) {
        issues.push({
          severity: 'error',
          line,
          snippet,
          message: `The URI scheme '${scheme}' is not allowed here; use ${schemes.join(', ')}.`,
        });
      } else if (
        scheme === 'https' &&
        !isAbsoluteUrl(value, ['https']) // defensive: should be unreachable
      ) {
        issues.push({
          severity: 'error',
          line,
          snippet,
          message: `'${value}' is not a valid URL.`,
        });
      }
    }
  }

  const langs = fields['preferred-languages'] ?? [];
  if (langs.length > 1) {
    issues.push({
      severity: 'error',
      line: langs[1].line,
      message: "'Preferred-Languages' must appear only once.",
    });
  }
  if (langs[0]) {
    const tags = langs[0].value.split(',').map((t) => t.trim());
    if (tags.some((t) => !LANG_TAG.test(t))) {
      issues.push({
        severity: 'error',
        line: langs[0].line,
        snippet: `Preferred-Languages: ${langs[0].value}`,
        message:
          "'Preferred-Languages' must be a comma separated list of language tags.",
      });
    }
  }

  if (options.url && fields['canonical']) {
    const wanted = options.url.replace(/\/$/, '');
    if (
      !fields['canonical'].some((c) => c.value.replace(/\/$/, '') === wanted)
    ) {
      issues.push({
        severity: 'warning',
        line: fields['canonical'][0].line,
        message: `No 'Canonical' field matches the URL the file was served from (${options.url}).`,
      });
    }
  }
  return issues;
}
