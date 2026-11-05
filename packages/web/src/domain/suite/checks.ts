/**
 * @packageDocumentation
 *
 * What a scan's checks found, in the form the suite works with. The scanner
 * container runs every check of the catalogue (see `scanner.ts`); each check
 * that ran becomes a {@link CheckResult} named by its id, which is the id a
 * rule in `plumbline.yaml` uses. A check the scanner could not run (it timed
 * out, or it needs a browser) is not a result: it found nothing, and says
 * nothing about the site.
 */

import type { ScanOutcome } from '@/domain/suite/scanner';

/** One thing a check found. */
export interface Finding {
  readonly severity: 'error' | 'warning' | 'hint';
  readonly message: string;
}

/** What one check found. */
export interface CheckResult {
  /** The id of the check, as the catalogue and the rules name it. */
  readonly id: string;
  readonly findings: readonly Finding[];
}

/** The severity a finding is stored with: an informational note is a hint. */
function severityOf(
  level: ScanOutcome['findings'][number]['level'],
): Finding['severity'] {
  return level === 'information' ? 'hint' : level;
}

/** The checks that ran, with their findings; skipped checks are left out. */
export function checksOf(outcomes: readonly ScanOutcome[]): CheckResult[] {
  return outcomes
    .filter((outcome) => outcome.status !== 'skipped')
    .map((outcome) => ({
      id: outcome.id,
      findings: outcome.findings.map((found) => ({
        severity: severityOf(found.level),
        message: found.message,
      })),
    }));
}

/** The ids of the checks that could not run. */
export function skippedOf(outcomes: readonly ScanOutcome[]): string[] {
  return outcomes
    .filter((outcome) => outcome.status === 'skipped')
    .map((outcome) => outcome.id);
}
