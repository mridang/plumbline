/**
 * @packageDocumentation
 *
 * What a run found, in the form that is stored, and what changed between two
 * runs. Checks that found nothing are not stored, and a finding is the same
 * one when its check and message are the same.
 */

import type { CheckResult } from '@/domain/suite/checks';

/** One thing a run found. */
export interface StoredFinding {
  readonly id: string;
  readonly severity: 'error' | 'warning' | 'hint';
  readonly message: string;
}

/** The findings of a run, flat, without the checks that passed. */
export function findingsOf(checks: readonly CheckResult[]): StoredFinding[] {
  return checks.flatMap((check) =>
    check.findings.map((found) => ({
      id: check.id,
      severity: found.severity,
      message: found.message,
    })),
  );
}

/** What changed from one run to the next. */
export interface Changes {
  /** Found now, not before. */
  readonly added: readonly StoredFinding[];
  /** Found before, not now. */
  readonly fixed: readonly StoredFinding[];
}

const keyOf = (found: StoredFinding): string => `${found.id}\n${found.message}`;

/** The findings that appeared and the ones that went away. */
export function diffFindings(
  before: readonly StoredFinding[],
  after: readonly StoredFinding[],
): Changes {
  const was = new Set(before.map(keyOf));
  const is = new Set(after.map(keyOf));
  return {
    added: after.filter((found) => !was.has(keyOf(found))),
    fixed: before.filter((found) => !is.has(keyOf(found))),
  };
}
