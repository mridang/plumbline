import { splitLines } from '../files/issue.js';
import type { FileIssue } from '../files/issue.js';

/**
 * The variables the ads.txt / app-ads.txt specification defines. A line
 * `NAME=value` is a variable record when NAME (upper-cased) is one of these.
 * See IAB Tech Lab "ads.txt" specification v1.1, section 3.3 and the
 * app-ads.txt addendum.
 */
const VARIABLES = new Set([
  'contact',
  'subdomain',
  'ownerdomain',
  'managerdomain',
  // Introduced alongside v1.1 for programmatic inventory sharing; widely
  // honoured, so it is accepted rather than flagged as unknown.
  'inventorypartnerdomain',
]);

/**
 * The account relationship enumeration for a data record's third field.
 * The specification defines exactly these two values (section 3.4.2) and
 * treats them case-insensitively.
 */
const RELATIONSHIPS = new Set(['direct', 'reseller']);

/** Strips an inline comment (everything from the first `#`) and trims. */
function stripComment(line: string): string {
  const hash = line.indexOf('#');
  return (hash === -1 ? line : line.slice(0, hash)).trim();
}

/** Checks a `NAME=value` variable line. */
function checkVariable(content: string, eq: number, line: number): FileIssue[] {
  const name = content.slice(0, eq).trim().toLowerCase();
  const value = content.slice(eq + 1).trim();
  if (!VARIABLES.has(name)) {
    return [
      {
        severity: 'warning',
        line,
        snippet: content,
        message: `Unknown variable '${content.slice(0, eq).trim()}'; expected one of CONTACT, SUBDOMAIN, OWNERDOMAIN, MANAGERDOMAIN, INVENTORYPARTNERDOMAIN.`,
      },
    ];
  }
  if (value === '') {
    return [
      {
        severity: 'error',
        line,
        snippet: content,
        message: `The '${content.slice(0, eq).trim()}' variable has no value.`,
      },
    ];
  }
  // A known variable with a value is valid.
  return [];
}

/** Checks a data record line: comma-separated fields, spaces not significant. */
function checkRecord(content: string, line: number): FileIssue[] {
  const fields = content.split(',').map((field) => field.trim());
  if (fields.length < 3) {
    return [
      {
        severity: 'error',
        line,
        snippet: content,
        message:
          'Malformed record; expected at least domain, publisher account id and DIRECT or RESELLER.',
      },
    ];
  }
  const [domain, publisherId, relationship] = fields;
  const issue = (message: string): FileIssue => ({
    severity: 'error',
    line,
    snippet: content,
    message,
  });
  return [
    ...(domain === ''
      ? [issue('The advertising system domain (first field) is empty.')]
      : []),
    ...(publisherId === ''
      ? [issue('The publisher account id (second field) is empty.')]
      : []),
    ...(RELATIONSHIPS.has(relationship.toLowerCase())
      ? []
      : [
          issue(
            `The account relationship (third field) must be DIRECT or RESELLER, not '${relationship}'.`,
          ),
        ]),
  ];
}

/**
 * Validates the text of an ads.txt or app-ads.txt file against the IAB Tech
 * Lab "ads.txt" specification v1.1. The grammar is line based: blank lines
 * and `#` comments are ignored, a `NAME=value` line is a variable, and every
 * other line is a data record of comma-separated fields
 * `exchange domain, publisher account id, DIRECT|RESELLER[, cert authority id]`.
 * Malformed records and unknown variables are reported with their line.
 */
export function validateAdsTxt(text: string): FileIssue[] {
  // Blank lines and comment-only lines carry no record.
  const entries = splitLines(text).flatMap((raw, index) => {
    const content = stripComment(raw);
    return content === '' ? [] : [{ content, line: index + 1 }];
  });
  // A variable line has the form NAME=value, where NAME contains no comma
  // (a data record's first field is a domain and never contains `=`).
  const classified = entries.map(({ content, line }) => {
    const eq = content.indexOf('=');
    return {
      content,
      line,
      eq,
      isVariable: eq !== -1 && !content.slice(0, eq).includes(','),
    };
  });
  const records = classified.filter((entry) => !entry.isVariable).length;
  const issues = classified.flatMap(({ content, line, eq, isVariable }) =>
    isVariable ? checkVariable(content, eq, line) : checkRecord(content, line),
  );

  // A file with no variable and no data record is not a useful ads.txt.
  return records === 0
    ? [
        ...issues,
        {
          severity: 'warning',
          message: 'The file contains no advertising-system records.',
        },
      ]
    : issues;
}
