import type { FileIssue } from '../files/issue.js';
import { isObject, parsedOrIssue } from './json.js';

/**
 * ISO 8601 / RFC 3339 date or date-time, the format the Global Privacy
 * Control specification gives for `lastUpdate`. Either a bare `YYYY-MM-DD`
 * or a full date-time is accepted.
 */
const DATE = String.raw`\d{4}-\d{2}-\d{2}`;
const TIME = String.raw`[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?`;
const ZONE = String.raw`([Zz]|[+-]\d{2}:\d{2})?`;
export const ISO_DATE = new RegExp(`^${DATE}(${TIME}${ZONE})?$`);

/**
 * Validates a Global Privacy Control well-known resource (gpc.json). The
 * document is a JSON object with a required boolean `gpc` and a required
 * `lastUpdate` string holding an ISO 8601 date. See
 * https://privacycg.github.io/gpc-spec/ section "Well-Known Resource".
 */
export function validateGpcJson(text: string): FileIssue[] {
  const issues: FileIssue[] = [];
  const root = parsedOrIssue(text, issues);
  if (root === undefined) {
    return issues;
  }
  if (!isObject(root)) {
    issues.push({
      severity: 'error',
      message: 'The top-level value must be a JSON object.',
    });
    return issues;
  }

  // `gpc` states whether the server honours Global Privacy Control and must
  // be a boolean.
  if (typeof root['gpc'] !== 'boolean') {
    issues.push({
      severity: 'error',
      message: "The required 'gpc' field must be a boolean.",
    });
  }

  // `lastUpdate` is a required ISO 8601 date string.
  const lastUpdate = root['lastUpdate'];
  if (typeof lastUpdate !== 'string') {
    issues.push({
      severity: 'error',
      message: "The required 'lastUpdate' field must be a string.",
    });
  } else if (
    !ISO_DATE.test(lastUpdate) ||
    Number.isNaN(Date.parse(lastUpdate))
  ) {
    issues.push({
      severity: 'error',
      message: "The 'lastUpdate' field must be an ISO 8601 date.",
    });
  } else {
    // A valid ISO 8601 date: nothing to report.
  }

  return issues;
}
