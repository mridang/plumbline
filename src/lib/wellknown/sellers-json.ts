import type { FileIssue } from '../files/issue.js';
import { isObject, parsedOrIssue } from './json.js';

/**
 * The seller types the IAB Tech Lab "sellers.json" specification defines for
 * a seller's `seller_type` (section 3.1). Compared case-insensitively.
 */
const SELLER_TYPES = new Set(['publisher', 'intermediary', 'both']);

/** True when a confidentiality flag is set (the spec uses the integer 1). */
function isConfidential(seller: Record<string, unknown>): boolean {
  return seller['is_confidential'] === 1 || seller['is_confidential'] === true;
}

/**
 * Validates the text of a sellers.json file against the IAB Tech Lab
 * "sellers.json" specification v1.0. The document is a JSON object with a
 * required `version`, an optional `contact_email` and `identifiers`, and a
 * required `sellers` array. Each seller needs a `seller_id` and a
 * `seller_type` of PUBLISHER, INTERMEDIARY or BOTH, and must give a `name`
 * and `domain` unless it is marked confidential (section 3).
 */
export function validateSellersJson(text: string): FileIssue[] {
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

  // `version` is required and identifies the schema revision (section 3.3).
  if (typeof root['version'] !== 'string' || root['version'].trim() === '') {
    issues.push({
      severity: 'error',
      message: "The required 'version' field is missing or not a string.",
    });
  }
  // `contact_email` is optional, but when present it must be a string.
  if (
    root['contact_email'] !== undefined &&
    typeof root['contact_email'] !== 'string'
  ) {
    issues.push({
      severity: 'error',
      message: "The 'contact_email' field must be a string.",
    });
  }
  // `identifiers` is optional; when present it is an array of {name, value}.
  if (root['identifiers'] !== undefined) {
    if (!Array.isArray(root['identifiers'])) {
      issues.push({
        severity: 'error',
        message: "The 'identifiers' field must be an array.",
      });
    } else {
      root['identifiers'].forEach((entry, i) => {
        if (
          !isObject(entry) ||
          typeof entry['name'] !== 'string' ||
          typeof entry['value'] !== 'string'
        ) {
          issues.push({
            severity: 'error',
            message: `identifiers[${i}] must have string 'name' and 'value' fields.`,
          });
        }
      });
    }
  }

  const sellers = root['sellers'];
  if (!Array.isArray(sellers)) {
    issues.push({
      severity: 'error',
      message: "The required 'sellers' field must be an array.",
    });
    return issues;
  }

  const seenIds = new Set<string>();
  sellers.forEach((seller, i) => {
    if (!isObject(seller)) {
      issues.push({
        severity: 'error',
        message: `sellers[${i}] must be an object.`,
      });
      return;
    }
    const id = seller['seller_id'];
    if (typeof id !== 'string' || id.trim() === '') {
      issues.push({
        severity: 'error',
        message: `sellers[${i}] is missing a string 'seller_id'.`,
      });
    } else if (seenIds.has(id)) {
      // Section 3.1: seller_id must be unique within the file.
      issues.push({
        severity: 'error',
        message: `sellers[${i}] repeats the seller_id '${id}', which must be unique.`,
      });
    } else {
      seenIds.add(id);
    }

    const type = seller['seller_type'];
    if (typeof type !== 'string' || !SELLER_TYPES.has(type.toLowerCase())) {
      issues.push({
        severity: 'error',
        message: `sellers[${i}] has an invalid seller_type; expected PUBLISHER, INTERMEDIARY or BOTH.`,
      });
    }

    // name and domain are required unless the seller is confidential.
    if (!isConfidential(seller)) {
      if (typeof seller['name'] !== 'string' || seller['name'].trim() === '') {
        issues.push({
          severity: 'error',
          message: `sellers[${i}] must have a 'name' unless it is confidential.`,
        });
      }
      if (
        typeof seller['domain'] !== 'string' ||
        seller['domain'].trim() === ''
      ) {
        issues.push({
          severity: 'error',
          message: `sellers[${i}] must have a 'domain' unless it is confidential.`,
        });
      }
    }
  });

  return issues;
}
