import { isAbsoluteUrl, splitLines } from './issue.js';
import type { FileIssue } from './issue.js';

/** Matches a trailing slash. */
const TRAILING_SLASH = /\/$/u;

/** Matches a trailing colon. */
const TRAILING_COLON = /:$/u;

const RFC3339 =
  /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/u;
const LANG_TAG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/u;
const YEAR_MS = 366 * 24 * 3600 * 1000;

export interface SecurityTxtOptions {
  /** The URL the file was served from, to check `Canonical` against. */
  url?: string;
  /** The current time; injectable for tests. */
  now?: Date;
}

/** Web URI fields and the schemes RFC 9116 allows for each. */
const URI_FIELDS = {
  contact: ['https', 'mailto', 'tel'],
  encryption: ['https', 'openpgp4fpr', 'dns'],
  policy: ['https'],
  acknowledgments: ['https'],
  hiring: ['https'],
  csaf: ['https'],
  canonical: ['https'],
};

/** The lines of a security.txt body, the index of its first line, and what was wrong with the envelope. */
interface SignatureSplit {
  body: string[];
  offset: number;
  issues: FileIssue[];
}

/** Removes the OpenPGP clearsign envelope; returns null on a broken one. */
function stripSignature(lines: string[]): SignatureSplit {
  if (!lines[0]?.startsWith('-----BEGIN PGP SIGNED MESSAGE-----')) {
    return { body: lines, offset: 0, issues: [] };
  }
  const blank = lines.findIndex((l, index) => index > 0 && l.trim() === '');
  const sig = lines.findIndex((l) =>
    l.startsWith('-----BEGIN PGP SIGNATURE-----'),
  );
  if (blank === -1 || sig === -1) {
    return {
      body: lines,
      offset: 0,
      issues: [
        {
          severity: 'error',
          line: 1,
          message: 'The PGP clearsigned message is malformed.',
        },
      ],
    };
  }
  return {
    body: lines.slice(blank + 1, sig),
    offset: blank + 1,
    issues: lines.some((l) => l.startsWith('-----END PGP SIGNATURE-----'))
      ? []
      : [
          {
            severity: 'error',
            line: sig + 1,
            message: 'The PGP signature block is not terminated.',
          },
        ],
  };
}

/** Validates the text of a security.txt file against RFC 9116. */
export function validateSecurityTxt(
  text: string,
  options: SecurityTxtOptions = {},
): FileIssue[] {
  const now = options.now ?? new Date();
  const {
    body,
    offset,
    issues: signatureIssues,
  } = stripSignature(splitLines(text));
  const entries = body
    .map((raw, index) => ({ line: index + offset + 1, trimmed: raw.trim() }))
    // Blank lines and comments carry no field.
    .filter(({ trimmed }) => trimmed !== '' && !trimmed.startsWith('#'))
    .map(({ line, trimmed }) => ({
      line,
      trimmed,
      colon: trimmed.indexOf(':'),
    }));
  const lineIssues = entries
    .filter(({ colon }) => colon < 1)
    .map(({ line, trimmed }): FileIssue => ({
      severity: 'error',
      line,
      snippet: trimmed,
      message: "Invalid line, expected 'Field: value'.",
    }));
  const parsed = entries
    .filter(({ colon }) => colon >= 1)
    .map(({ line, trimmed, colon }) => ({
      name: trimmed.slice(0, colon).trim().toLowerCase(),
      // Dash-escaped lines in signed files start with "- ".
      value: trimmed.slice(colon + 1).trim(),
      line,
    }));
  const fieldsOf = (name: string): { value: string; line: number }[] =>
    parsed.filter((field) => field.name === name);

  const expires = fieldsOf('expires');
  const first = expires.at(0);
  const time =
    first && RFC3339.test(first.value) ? Date.parse(first.value) : Number.NaN;
  const expiresAt = {
    line: first?.line,
    snippet: `Expires: ${first?.value}`,
  };
  const expiresIssues: (FileIssue | false)[] = [
    expires.length > 1 && {
      severity: 'error',
      line: expires[1].line,
      snippet: `Expires: ${expires[1].value}`,
      message: "The 'Expires' field must appear only once.",
    },
    !!first &&
      Number.isNaN(time) && {
        severity: 'error',
        ...expiresAt,
        message: "'Expires' must be an RFC 3339 date-time.",
      },
    !!first &&
      !Number.isNaN(time) &&
      time < now.getTime() && {
        severity: 'error',
        ...expiresAt,
        message: 'The file has expired.',
      },
    // An expiry within one year is acceptable.
    !!first &&
      time - now.getTime() > YEAR_MS && {
        severity: 'warning',
        ...expiresAt,
        message: "'Expires' should be less than one year in the future.",
      },
  ];

  const uriIssues = Object.entries(URI_FIELDS).flatMap(([field, schemes]) =>
    fieldsOf(field).flatMap(({ value, line }): FileIssue[] => {
      const snippet = `${field[0].toUpperCase()}${field.slice(1)}: ${value}`;
      const error = (message: string): FileIssue[] => [
        { severity: 'error', line, snippet, message },
      ];
      if (!URL.canParse(value)) {
        return error(`'${value}' is not a valid URI.`);
      }
      const scheme = new URL(value).protocol.replace(TRAILING_COLON, '');
      if (scheme === 'http') {
        return error('Web URIs must use HTTPS.');
      }
      if (!schemes.includes(scheme)) {
        return error(
          `The URI scheme '${scheme}' is not allowed here; use ${schemes.join(', ')}.`,
        );
      }
      if (
        scheme === 'https' &&
        !isAbsoluteUrl(value, ['https']) // defensive: should be unreachable
      ) {
        return error(`'${value}' is not a valid URL.`);
      }
      return [];
    }),
  );

  const langs = fieldsOf('preferred-languages');
  const tags =
    langs
      .at(0)
      ?.value.split(',')
      .map((t) => t.trim()) ?? [];
  const languageIssues: (FileIssue | false)[] = [
    langs.length > 1 && {
      severity: 'error',
      line: langs[1].line,
      message: "'Preferred-Languages' must appear only once.",
    },
    langs.length > 0 &&
      tags.some((t) => !LANG_TAG.test(t)) && {
        severity: 'error',
        line: langs[0].line,
        snippet: `Preferred-Languages: ${langs[0].value}`,
        message:
          "'Preferred-Languages' must be a comma separated list of language tags.",
      },
  ];

  const canonical = fieldsOf('canonical');
  const wanted = options.url?.replace(TRAILING_SLASH, '');
  const issues: (FileIssue | false)[] = [
    // Internet.nl only reads the first 100 KiB of the file.
    Buffer.byteLength(text, 'utf8') > 100 * 1024 && {
      severity: 'warning',
      message: 'The file is larger than 100 KiB; checkers may ignore the rest.',
    },
    ...signatureIssues,
    ...lineIssues,
    ...['contact', 'expires'].flatMap((required): FileIssue[] =>
      fieldsOf(required).length > 0
        ? []
        : [
            {
              severity: 'error',
              message: `The required '${required === 'contact' ? 'Contact' : 'Expires'}' field is missing.`,
            },
          ],
    ),
    ...expiresIssues,
    ...uriIssues,
    ...languageIssues,
    !!options.url &&
      canonical.length > 0 &&
      !canonical.some(
        (c) => c.value.replace(TRAILING_SLASH, '') === wanted,
      ) && {
        severity: 'warning',
        line: canonical[0].line,
        message: `No 'Canonical' field matches the URL the file was served from (${options.url}).`,
      },
  ];
  return issues.filter((issue) => issue !== false);
}
