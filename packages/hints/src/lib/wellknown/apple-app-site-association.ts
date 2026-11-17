import { isObject, isStringArray, parsedOrIssue } from './json.js';
import type { FileIssue } from '../files/issue.js';

/** The three top-level services Apple defines for the association file. */
const SERVICES = ['applinks', 'webcredentials', 'appclips'];

/**
 * Validates one `applinks.details` entry. Each entry names an app either by
 * the modern `appIDs` array or the legacy single `appID`, and lists URL
 * matching rules under the modern `components` array or the legacy `paths`
 * array. Apple's reference:
 * https://developer.apple.com/documentation/xcode/supporting-associated-domains.
 */
function validateDetail(detail: unknown, index: number): FileIssue[] {
  if (!isObject(detail)) {
    return [
      {
        severity: 'error',
        message: `applinks.details[${index}] must be an object.`,
      },
    ];
  }
  const hasAppId = typeof detail.appID === 'string';
  const hasAppIds = isStringArray(detail.appIDs);
  return [
    ...(hasAppId || hasAppIds
      ? []
      : [
          {
            severity: 'error' as const,
            message: `applinks.details[${index}] must have a string 'appID' or a string array 'appIDs'.`,
          },
        ]),
    // One of components (modern) or paths (legacy) carries the match rules.
    ...(detail.components !== undefined && !Array.isArray(detail.components)
      ? [
          {
            severity: 'error' as const,
            message: `applinks.details[${index}].components must be an array.`,
          },
        ]
      : []),
    ...(detail.paths !== undefined && !isStringArray(detail.paths)
      ? [
          {
            severity: 'error' as const,
            message: `applinks.details[${index}].paths must be an array of strings.`,
          },
        ]
      : []),
  ];
}

/** Validates the `applinks` service object. */
function validateApplinks(value: unknown): FileIssue[] {
  if (!isObject(value)) {
    return [
      {
        severity: 'error',
        message: "'applinks' must be an object.",
      },
    ];
  }
  const details = value.details;
  const detailIssues = Array.isArray(details)
    ? details.flatMap((detail, index) => validateDetail(detail, index))
    : [];
  return [
    // Apple requires `apps` to be present and empty (historical compatibility).
    ...(value.apps !== undefined && !isStringArray(value.apps)
      ? [
          {
            severity: 'error' as const,
            message: "'applinks.apps' must be an array.",
          },
        ]
      : []),
    ...(details !== undefined && !Array.isArray(details)
      ? [
          {
            severity: 'error' as const,
            message: "'applinks.details' must be an array.",
          },
        ]
      : []),
    ...detailIssues,
  ];
}

/** Validates a service whose only member is an `apps` string array. */
function validateAppsService(name: string, value: unknown): FileIssue[] {
  if (!isObject(value)) {
    return [
      {
        severity: 'error',
        message: `'${name}' must be an object.`,
      },
    ];
  }
  return isStringArray(value.apps)
    ? []
    : [
        {
          severity: 'error',
          message: `'${name}.apps' must be an array of app identifiers.`,
        },
      ];
}

/**
 * Validates an apple-app-site-association (AASA) file. It is a JSON object
 * (served without a .json extension) that declares at least one of the
 * `applinks`, `webcredentials` and `appclips` services. Each service is
 * checked for the shape Apple documents.
 */
export function validateAppleAppSiteAssociation(text: string): FileIssue[] {
  const parseIssues: FileIssue[] = [];
  const root = parsedOrIssue(text, parseIssues);
  if (root === undefined) {
    return parseIssues;
  }
  if (!isObject(root)) {
    return [
      {
        severity: 'error',
        message: 'The top-level value must be a JSON object.',
      },
    ];
  }
  return [
    // At least one recognised service must be declared, or the file does
    // nothing.
    ...(SERVICES.some((service) => root[service] !== undefined)
      ? []
      : [
          {
            severity: 'error' as const,
            message:
              'The file declares none of applinks, webcredentials or appclips.',
          },
        ]),
    ...(root.applinks === undefined ? [] : validateApplinks(root.applinks)),
    ...(root.webcredentials === undefined
      ? []
      : validateAppsService('webcredentials', root.webcredentials)),
    ...(root.appclips === undefined
      ? []
      : validateAppsService('appclips', root.appclips)),
  ];
}
