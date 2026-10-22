/**
 * The modern reporting, isolation and integrity response headers. Each follows
 * its MDN reference page: `Reporting-Endpoints` and `Integrity-Policy[-Report-
 * Only]` are RFC 8941 structured-header dictionaries, `NEL` is a JSON object,
 * and `Origin-Agent-Cluster` is a structured boolean. The checks validate the
 * value when the header is present and recommend `Origin-Agent-Cluster`.
 */
import { finding, type Finding } from './finding.js';

/**
 * Splits a structured-field dictionary into its `key=value` members at the
 * top-level commas, ignoring commas inside quoted strings. Returns null when
 * the value is empty.
 */
function dictionaryMembers(value: string): string[] | null {
  const members: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of value) {
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === ',' && !inQuotes) {
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

const KEY = /^[a-z*][a-z0-9_.*-]*$/;

/**
 * `Reporting-Endpoints` maps endpoint names to the URL reports are posted to,
 * as a structured dictionary: `name="https://example.com/reports"`. Every
 * value must be a quoted string holding an absolute `https:` URL; anything
 * else is reported so the reporting configuration is not silently ignored.
 */
export function reportingEndpointsFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  const members = dictionaryMembers(value);
  if (!members) {
    return [
      finding(
        'warning',
        'The \'Reporting-Endpoints\' header is empty; remove it or list name="https-url" endpoints.',
      ),
    ];
  }
  for (const member of members) {
    const equals = member.indexOf('=');
    const key = equals === -1 ? member : member.slice(0, equals);
    const raw = equals === -1 ? '' : member.slice(equals + 1).trim();
    if (equals === -1 || !KEY.test(key.trim())) {
      return [
        finding(
          'warning',
          `The 'Reporting-Endpoints' header has an invalid member '${member}'; use name="https-url".`,
        ),
      ];
    }
    const url = /^"(.*)"$/.exec(raw)?.[1];
    if (url === undefined || !/^https:\/\//i.test(url)) {
      return [
        finding(
          'warning',
          `The endpoint '${key.trim()}' in 'Reporting-Endpoints' must be a quoted absolute https URL, not '${raw}'.`,
        ),
      ];
    }
  }
  return [];
}

/**
 * `NEL` (Network Error Logging) is a JSON object. It must parse, carry a
 * `max_age` (how long the policy is remembered) and name a `report_to` group
 * that an accompanying `Reporting-Endpoints`/`Report-To` header defines.
 * Unlike `csp-reporting`, this validates the policy's own shape, not where the
 * reports are sent.
 */
export function nelFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [finding('warning', "The 'NEL' header is not valid JSON.")];
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return [finding('warning', "The 'NEL' header must be a JSON object.")];
  }
  const policy = parsed as Record<string, unknown>;
  if (typeof policy.max_age !== 'number') {
    return [
      finding('warning', "The 'NEL' header must include a numeric 'max_age'."),
    ];
  }
  // max_age 0 is the documented way to clear a policy, so a group is only
  // required while the policy is active.
  if (
    policy.max_age > 0 &&
    (typeof policy.report_to !== 'string' || policy.report_to === '')
  ) {
    return [
      finding(
        'warning',
        "The 'NEL' header must name a 'report_to' reporting group defined by Reporting-Endpoints.",
      ),
    ];
  }
  return [];
}

/**
 * `Origin-Agent-Cluster` asks the browser to isolate the origin into its own
 * agent cluster. The only meaningful value is the structured boolean `?1`; it
 * is recommended when absent and reported when set to anything else.
 */
export function originAgentClusterFindings(value: string | null): Finding[] {
  if (value === null) {
    return [
      finding(
        'hint',
        "Consider sending 'Origin-Agent-Cluster: ?1' to request origin isolation.",
      ),
    ];
  }
  return value.trim() === '?1'
    ? []
    : [
        finding(
          'warning',
          `The 'Origin-Agent-Cluster' header should be '?1', not '${value}'.`,
        ),
      ];
}

/**
 * `Integrity-Policy` (and its report-only variant) is a structured dictionary
 * enforcing Subresource Integrity, for example
 * `blocked-destinations=(script)`. It must parse as a dictionary and declare a
 * non-empty `blocked-destinations` inner list; an empty or malformed value is
 * reported because the browser then enforces nothing.
 */
export function integrityPolicyFindings(
  name: string,
  value: string | null,
): Finding[] {
  if (value === null) {
    return [];
  }
  const members = dictionaryMembers(value);
  const blocked = members?.find((member) =>
    /^blocked-destinations\s*=/.test(member),
  );
  if (!members || !blocked) {
    return [
      finding(
        'warning',
        `The '${name}' header must declare a 'blocked-destinations' inner list, for example 'blocked-destinations=(script)'.`,
      ),
    ];
  }
  const list = /=\s*\((.*)\)\s*$/.exec(blocked)?.[1];
  if (list === undefined || list.trim() === '') {
    return [
      finding(
        'warning',
        `The 'blocked-destinations' of the '${name}' header is empty, so no destination is protected.`,
      ),
    ];
  }
  return [];
}
