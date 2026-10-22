import type { FileIssue } from '../files/issue.js';

/** The result of parsing a JSON document: either a value or a parse error. */
interface JsonParse {
  /** The parsed value, or undefined when parsing failed. */
  value?: unknown;
  /** A human-readable parse error, or undefined when parsing succeeded. */
  error?: string;
}

/**
 * Parses JSON text, returning the value or a readable error instead of
 * throwing. Validators call this first so a broken document produces one
 * clear finding rather than an exception.
 */
function parseJson(text: string): JsonParse {
  try {
    return { value: JSON.parse(text) as unknown };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

/** True when `value` is a non-null, non-array plain object. */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when `value` is an array of strings. */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * Reports a JSON parse error as a single `error` finding, or returns the
 * parsed value. Every JSON validator opens with this so the common
 * "not valid JSON" path is identical across hints.
 */
export function parsedOrIssue(
  text: string,
  issues: FileIssue[],
): unknown | undefined {
  const { value, error } = parseJson(text);
  if (error !== undefined) {
    issues.push({
      severity: 'error',
      message: `The file is not valid JSON: ${error}.`,
    });
    return undefined;
  }
  return value;
}
