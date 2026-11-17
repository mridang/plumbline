import { isObject, isStringArray, parsedOrIssue } from './json.js';
import type { FileIssue } from '../files/issue.js';

/**
 * Validates one Digital Asset Links statement. A statement has a non-empty
 * `relation` array of strings and a `target` object whose `namespace` is
 * either `android_app` (then `package_name` and `sha256_cert_fingerprints`
 * are required) or `web` (then `site` is required). See
 * https://developers.google.com/digital-asset-links/v1/statements.
 */
function validateStatement(statement: unknown, index: number): FileIssue[] {
  if (!isObject(statement)) {
    return [
      {
        severity: 'error',
        message: `statement[${index}] must be an object.`,
      },
    ];
  }

  // `relation` is a non-empty array of relation strings such as
  // "delegate_permission/common.handle_all_urls".
  const { relation } = statement;
  const relationIssues: FileIssue[] =
    !isStringArray(relation) || relation.length === 0
      ? [
          {
            severity: 'error',
            message: `statement[${index}].relation must be a non-empty array of strings.`,
          },
        ]
      : [];

  const { target } = statement;
  if (!isObject(target)) {
    return [
      ...relationIssues,
      {
        severity: 'error',
        message: `statement[${index}].target must be an object.`,
      },
    ];
  }

  const namespace = target.namespace;
  const fingerprints = target.sha256_cert_fingerprints;
  const targetIssues: FileIssue[] = (() => {
    if (namespace === 'android_app') {
      return [
        ...(typeof target.package_name !== 'string' ||
        target.package_name.trim() === ''
          ? [
              {
                severity: 'error' as const,
                message: `statement[${index}].target is an android_app but has no 'package_name'.`,
              },
            ]
          : []),
        ...(!isStringArray(fingerprints) || fingerprints.length === 0
          ? [
              {
                severity: 'error' as const,
                message: `statement[${index}].target is an android_app but has no 'sha256_cert_fingerprints'.`,
              },
            ]
          : []),
      ];
    }
    if (namespace === 'web') {
      return typeof target.site !== 'string' || target.site.trim() === ''
        ? [
            {
              severity: 'error' as const,
              message: `statement[${index}].target is a web target but has no 'site'.`,
            },
          ]
        : [];
    }
    return [
      {
        severity: 'error' as const,
        message: `statement[${index}].target.namespace must be 'android_app' or 'web'.`,
      },
    ];
  })();
  return [...relationIssues, ...targetIssues];
}

/**
 * Validates an Android Digital Asset Links assetlinks.json file. The document
 * is a JSON array of statement objects, each linking the site to an app or
 * another site. Reports a non-array document and every malformed statement.
 */
export function validateAssetlinksJson(text: string): FileIssue[] {
  const parseIssues: FileIssue[] = [];
  const root = parsedOrIssue(text, parseIssues);
  if (root === undefined) {
    return parseIssues;
  }
  if (!Array.isArray(root)) {
    return [
      {
        severity: 'error',
        message: 'The top-level value must be a JSON array of statements.',
      },
    ];
  }
  return [
    ...(root.length === 0
      ? [
          {
            severity: 'warning' as const,
            message: 'The file contains no statements.',
          },
        ]
      : []),
    ...root.flatMap((statement, index) => validateStatement(statement, index)),
  ];
}
