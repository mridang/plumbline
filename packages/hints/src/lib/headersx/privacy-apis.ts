/**
 * The privacy-sensitive opt-in response headers of the Privacy Sandbox. Both
 * are experimental and visible only when a site opts into an ad-measurement or
 * interest API, so the checks report their *presence* (the site participates)
 * and validate the value, rather than recommending them. Each follows its MDN
 * reference page.
 */
import { finding, type Finding } from '../headers/finding.js';

/**
 * `Attribution-Reporting-Register-Source` and
 * `Attribution-Reporting-Register-Trigger` register a source or a trigger with
 * the Attribution Reporting API, the Privacy Sandbox replacement for
 * third-party-cookie ad measurement. Each value is a JSON object. The check
 * reports that the response takes part in attribution reporting (a privacy
 * signal worth surfacing) and warns when the registration is not valid JSON,
 * since the browser then silently ignores it.
 * @param source - The `Attribution-Reporting-Register-Source` value, or null.
 * @param trigger - The `Attribution-Reporting-Register-Trigger` value, or null.
 */
export function attributionReportingFindings(
  source: string | null,
  trigger: string | null,
): Finding[] {
  const findings: Finding[] = [];
  const checks: ReadonlyArray<[string, string | null]> = [
    ['Attribution-Reporting-Register-Source', source],
    ['Attribution-Reporting-Register-Trigger', trigger],
  ];
  for (const [name, value] of checks) {
    if (value === null) {
      continue;
    }
    const problem = registrationProblem(name, value);
    if (problem) {
      findings.push(problem);
    } else {
      findings.push(
        finding(
          'hint',
          `The '${name}' header registers this response with the Attribution Reporting API (ad measurement).`,
        ),
      );
    }
  }
  return findings;
}

/** The warning for a registration that is not a JSON object, or null when it is one. */
function registrationProblem(name: string, value: string): Finding | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return finding('warning', `The '${name}' header must be a JSON object.`);
    }
    return null;
  } catch {
    return finding(
      'warning',
      `The '${name}' header must be valid JSON, or the registration is ignored.`,
    );
  }
}

/**
 * `Observe-Browsing-Topics` opts a response into the Topics API: the browser
 * may record the page's topics for later interest-based advertising. The only
 * defined value is the structured boolean `?1`. The check reports participation
 * when the header is present and valid, and warns on any other value because
 * the browser treats only `?1` as opting in.
 */
export function observeBrowsingTopicsFindings(value: string | null): Finding[] {
  if (value === null) {
    return [];
  }
  if (value.trim() !== '?1') {
    return [
      finding(
        'warning',
        `The 'Observe-Browsing-Topics' header must be the structured boolean '?1', not '${value}'.`,
      ),
    ];
  }
  return [
    finding(
      'hint',
      "The 'Observe-Browsing-Topics: ?1' header opts this response into the Topics API, recording the visitor's interests for advertising.",
    ),
  ];
}
