import { splitLines, type FileIssue } from '../files/issue.js';

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

/**
 * Validates the text of an ads.txt or app-ads.txt file against the IAB Tech
 * Lab "ads.txt" specification v1.1. The grammar is line based: blank lines
 * and `#` comments are ignored, a `NAME=value` line is a variable, and every
 * other line is a data record of comma-separated fields
 * `exchange domain, publisher account id, DIRECT|RESELLER[, cert authority id]`.
 * Malformed records and unknown variables are reported with their line.
 */
export function validateAdsTxt(text: string): FileIssue[] {
  const issues: FileIssue[] = [];
  const lines = splitLines(text);
  let records = 0;

  lines.forEach((raw, index) => {
    const line = index + 1;
    const content = stripComment(raw);
    // Blank lines and comment-only lines carry no record.
    if (content === '') {
      return;
    }

    // A variable line has the form NAME=value, where NAME contains no comma
    // (a data record's first field is a domain and never contains `=`).
    const eq = content.indexOf('=');
    if (eq !== -1 && !content.slice(0, eq).includes(',')) {
      const name = content.slice(0, eq).trim().toLowerCase();
      const value = content.slice(eq + 1).trim();
      if (!VARIABLES.has(name)) {
        issues.push({
          severity: 'warning',
          line,
          snippet: content,
          message: `Unknown variable '${content.slice(0, eq).trim()}'; expected one of CONTACT, SUBDOMAIN, OWNERDOMAIN, MANAGERDOMAIN, INVENTORYPARTNERDOMAIN.`,
        });
      } else if (value === '') {
        issues.push({
          severity: 'error',
          line,
          snippet: content,
          message: `The '${content.slice(0, eq).trim()}' variable has no value.`,
        });
      }
      return;
    }

    // Otherwise it is a data record: comma-separated fields, whitespace
    // around each field is not significant (section 3.4).
    const fields = content.split(',').map((field) => field.trim());
    records += 1;
    if (fields.length < 3) {
      issues.push({
        severity: 'error',
        line,
        snippet: content,
        message:
          'Malformed record; expected at least domain, publisher account id and DIRECT or RESELLER.',
      });
      return;
    }
    const [domain, publisherId, relationship] = fields;
    if (domain === '') {
      issues.push({
        severity: 'error',
        line,
        snippet: content,
        message: 'The advertising system domain (first field) is empty.',
      });
    }
    if (publisherId === '') {
      issues.push({
        severity: 'error',
        line,
        snippet: content,
        message: 'The publisher account id (second field) is empty.',
      });
    }
    if (!RELATIONSHIPS.has(relationship.toLowerCase())) {
      issues.push({
        severity: 'error',
        line,
        snippet: content,
        message: `The account relationship (third field) must be DIRECT or RESELLER, not '${relationship}'.`,
      });
    }
  });

  // A file with no variable and no data record is not a useful ads.txt.
  if (records === 0) {
    issues.push({
      severity: 'warning',
      message: 'The file contains no advertising-system records.',
    });
  }
  return issues;
}
