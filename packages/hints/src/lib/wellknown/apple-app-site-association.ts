import type { FileIssue } from '../files/issue.js';
import { isObject, isStringArray, parsedOrIssue } from './json.js';

/** The three top-level services Apple defines for the association file. */
const SERVICES = ['applinks', 'webcredentials', 'appclips'];

/**
 * Validates one `applinks.details` entry. Each entry names an app either by
 * the modern `appIDs` array or the legacy single `appID`, and lists URL
 * matching rules under the modern `components` array or the legacy `paths`
 * array. Apple's reference:
 * https://developer.apple.com/documentation/xcode/supporting-associated-domains.
 */
function validateDetail(
  detail: unknown,
  index: number,
  issues: FileIssue[],
): void {
  if (!isObject(detail)) {
    issues.push({
      severity: 'error',
      message: `applinks.details[${index}] must be an object.`,
    });
    return;
  }
  const hasAppId = typeof detail['appID'] === 'string';
  const hasAppIds = isStringArray(detail['appIDs']);
  if (!hasAppId && !hasAppIds) {
    issues.push({
      severity: 'error',
      message: `applinks.details[${index}] must have a string 'appID' or a string array 'appIDs'.`,
    });
  }
  // One of components (modern) or paths (legacy) carries the match rules.
  if (
    detail['components'] !== undefined &&
    !Array.isArray(detail['components'])
  ) {
    issues.push({
      severity: 'error',
      message: `applinks.details[${index}].components must be an array.`,
    });
  }
  if (detail['paths'] !== undefined && !isStringArray(detail['paths'])) {
    issues.push({
      severity: 'error',
      message: `applinks.details[${index}].paths must be an array of strings.`,
    });
  }
}

/** Validates the `applinks` service object. */
function validateApplinks(value: unknown, issues: FileIssue[]): void {
  if (!isObject(value)) {
    issues.push({
      severity: 'error',
      message: "'applinks' must be an object.",
    });
    return;
  }
  // Apple requires `apps` to be present and empty (historical compatibility).
  if (value['apps'] !== undefined && !isStringArray(value['apps'])) {
    issues.push({
      severity: 'error',
      message: "'applinks.apps' must be an array.",
    });
  }
  const details = value['details'];
  if (details !== undefined) {
    if (Array.isArray(details)) {
      details.forEach((detail, i) => validateDetail(detail, i, issues));
    } else {
      issues.push({
        severity: 'error',
        message: "'applinks.details' must be an array.",
      });
    }
  }
}

/** Validates a service whose only member is an `apps` string array. */
function validateAppsService(
  name: string,
  value: unknown,
  issues: FileIssue[],
): void {
  if (!isObject(value)) {
    issues.push({
      severity: 'error',
      message: `'${name}' must be an object.`,
    });
    return;
  }
  if (!isStringArray(value['apps'])) {
    issues.push({
      severity: 'error',
      message: `'${name}.apps' must be an array of app identifiers.`,
    });
  }
}

/**
 * Validates an apple-app-site-association (AASA) file. It is a JSON object
 * (served without a .json extension) that declares at least one of the
 * `applinks`, `webcredentials` and `appclips` services. Each service is
 * checked for the shape Apple documents.
 */
export function validateAppleAppSiteAssociation(text: string): FileIssue[] {
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

  // At least one recognised service must be declared, or the file does
  // nothing.
  if (!SERVICES.some((service) => root[service] !== undefined)) {
    issues.push({
      severity: 'error',
      message:
        'The file declares none of applinks, webcredentials or appclips.',
    });
  }

  if (root['applinks'] !== undefined) {
    validateApplinks(root['applinks'], issues);
  }
  if (root['webcredentials'] !== undefined) {
    validateAppsService('webcredentials', root['webcredentials'], issues);
  }
  if (root['appclips'] !== undefined) {
    validateAppsService('appclips', root['appclips'], issues);
  }

  return issues;
}
