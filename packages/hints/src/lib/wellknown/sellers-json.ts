import { isObject, parsedOrIssue } from './json.js';
import type { FileIssue } from '../files/issue.js';

/**
 * The seller types the IAB Tech Lab "sellers.json" specification defines for
 * a seller's `seller_type` (section 3.1). Compared case-insensitively.
 */
const SELLER_TYPES = new Set(['publisher', 'intermediary', 'both']);

/** True when a confidentiality flag is set (the spec uses the integer 1). */
function isConfidential(seller: Record<string, unknown>): boolean {
  return seller.is_confidential === 1 || seller.is_confidential === true;
}

/** Checks that `identifiers` is an array of `{name, value}` string pairs. */
function checkIdentifiers(identifiers: unknown): FileIssue[] {
  if (!Array.isArray(identifiers)) {
    return [
      {
        severity: 'error',
        message: "The 'identifiers' field must be an array.",
      },
    ];
  }
  return identifiers.flatMap((entry: unknown, index): FileIssue[] =>
    !isObject(entry) ||
    typeof entry.name !== 'string' ||
    typeof entry.value !== 'string'
      ? [
          {
            severity: 'error',
            message: `identifiers[${index}] must have string 'name' and 'value' fields.`,
          },
        ]
      : [],
  );
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

  const rootIssues: FileIssue[] = [
    // `version` is required and identifies the schema revision (section 3.3).
    ...(typeof root.version !== 'string' || root.version.trim() === ''
      ? [
          {
            severity: 'error' as const,
            message: "The required 'version' field is missing or not a string.",
          },
        ]
      : []),
    // `contact_email` is optional, but when present it must be a string.
    ...(root.contact_email !== undefined &&
    typeof root.contact_email !== 'string'
      ? [
          {
            severity: 'error' as const,
            message: "The 'contact_email' field must be a string.",
          },
        ]
      : []),
    // `identifiers` is optional; when present it is an array of {name, value}.
    ...(root.identifiers === undefined
      ? []
      : checkIdentifiers(root.identifiers)),
  ];

  const sellers = root.sellers;
  if (!Array.isArray(sellers)) {
    return [
      ...rootIssues,
      {
        severity: 'error',
        message: "The required 'sellers' field must be an array.",
      },
    ];
  }

  const sellerIssues = sellers.flatMap((seller, index): FileIssue[] => {
    if (!isObject(seller)) {
      return [
        {
          severity: 'error',
          message: `sellers[${index}] must be an object.`,
        },
      ];
    }
    const id = seller.seller_id;
    const type = seller.seller_type;
    const confidential = isConfidential(seller);
    return [
      ...(typeof id !== 'string' || id.trim() === ''
        ? [
            {
              severity: 'error' as const,
              message: `sellers[${index}] is missing a string 'seller_id'.`,
            },
          ]
        : []),
      // Section 3.1: seller_id must be unique within the file.
      ...(typeof id === 'string' &&
      id.trim() !== '' &&
      sellers
        .slice(0, index)
        .some((earlier) => isObject(earlier) && earlier.seller_id === id)
        ? [
            {
              severity: 'error' as const,
              message: `sellers[${index}] repeats the seller_id '${id}', which must be unique.`,
            },
          ]
        : []),
      ...(typeof type !== 'string' || !SELLER_TYPES.has(type.toLowerCase())
        ? [
            {
              severity: 'error' as const,
              message: `sellers[${index}] has an invalid seller_type; expected PUBLISHER, INTERMEDIARY or BOTH.`,
            },
          ]
        : []),
      // name and domain are required unless the seller is confidential.
      ...(!confidential &&
      (typeof seller.name !== 'string' || seller.name.trim() === '')
        ? [
            {
              severity: 'error' as const,
              message: `sellers[${index}] must have a 'name' unless it is confidential.`,
            },
          ]
        : []),
      ...(!confidential &&
      (typeof seller.domain !== 'string' || seller.domain.trim() === '')
        ? [
            {
              severity: 'error' as const,
              message: `sellers[${index}] must have a 'domain' unless it is confidential.`,
            },
          ]
        : []),
    ];
  });

  return [...rootIssues, ...sellerIssues];
}
