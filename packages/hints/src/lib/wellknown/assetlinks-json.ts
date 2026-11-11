import type { FileIssue } from '../files/issue.js';
import { isObject, isStringArray, parsedOrIssue } from './json.js';

/**
 * Validates one Digital Asset Links statement. A statement has a non-empty
 * `relation` array of strings and a `target` object whose `namespace` is
 * either `android_app` (then `package_name` and `sha256_cert_fingerprints`
 * are required) or `web` (then `site` is required). See
 * https://developers.google.com/digital-asset-links/v1/statements.
 */
function validateStatement(
  statement: unknown,
  index: number,
  issues: FileIssue[],
): void {
  if (!isObject(statement)) {
    issues.push({
      severity: 'error',
      message: `statement[${index}] must be an object.`,
    });
    return;
  }

  // `relation` is a non-empty array of relation strings such as
  // "delegate_permission/common.handle_all_urls".
  const relation = statement['relation'];
  if (!isStringArray(relation) || relation.length === 0) {
    issues.push({
      severity: 'error',
      message: `statement[${index}].relation must be a non-empty array of strings.`,
    });
  }

  const target = statement['target'];
  if (!isObject(target)) {
    issues.push({
      severity: 'error',
      message: `statement[${index}].target must be an object.`,
    });
    return;
  }

  const namespace = target['namespace'];
  if (namespace === 'android_app') {
    if (
      typeof target['package_name'] !== 'string' ||
      target['package_name'].trim() === ''
    ) {
      issues.push({
        severity: 'error',
        message: `statement[${index}].target is an android_app but has no 'package_name'.`,
      });
    }
    const fingerprints = target['sha256_cert_fingerprints'];
    if (!isStringArray(fingerprints) || fingerprints.length === 0) {
      issues.push({
        severity: 'error',
        message: `statement[${index}].target is an android_app but has no 'sha256_cert_fingerprints'.`,
      });
    }
  } else if (namespace === 'web') {
    if (typeof target['site'] !== 'string' || target['site'].trim() === '') {
      issues.push({
        severity: 'error',
        message: `statement[${index}].target is a web target but has no 'site'.`,
      });
    }
  } else {
    issues.push({
      severity: 'error',
      message: `statement[${index}].target.namespace must be 'android_app' or 'web'.`,
    });
  }
}

/**
 * Validates an Android Digital Asset Links assetlinks.json file. The document
 * is a JSON array of statement objects, each linking the site to an app or
 * another site. Reports a non-array document and every malformed statement.
 */
export function validateAssetlinksJson(text: string): FileIssue[] {
  const issues: FileIssue[] = [];
  const root = parsedOrIssue(text, issues);
  if (root === undefined) {
    return issues;
  }
  if (!Array.isArray(root)) {
    issues.push({
      severity: 'error',
      message: 'The top-level value must be a JSON array of statements.',
    });
    return issues;
  }
  if (root.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'The file contains no statements.',
    });
  }
  root.forEach((statement, i) => validateStatement(statement, i, issues));
  return issues;
}
