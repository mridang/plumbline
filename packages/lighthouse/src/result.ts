/**
 * Turns the plumbline library's {@link Finding} list into a Lighthouse
 * audit product. The mapping is the only policy this plugin adds on top of the
 * reused checks. It depends on the check's {@link ScoreMode}:
 *
 *   `numeric` (a graded check)
 *     - no findings            -> score 1   (pass)
 *     - at least one `error`   -> score 0   (fail)
 *     - only `warning`/`hint`  -> score 0.5 (advice).
 *
 *   `binary` (a pass/fail check)
 *     - no findings            -> score 1   (pass)
 *     - any finding            -> score 0   (fail).
 *
 *   `informative` (a context-specific check that should surface findings but
 *   never affect the category score, e.g. A check whose webhint hint is opt-in
 *   or needs a request Lighthouse cannot make)
 *     - score is always null; the findings are still listed.
 *
 * Every finding is also listed in a Lighthouse table (built with the sanctioned
 * `Audit.makeTableDetails` helper so the detail shape is always valid) and the
 * worst finding's message becomes the `displayValue`. Lighthouse renders the
 * table and escapes its text itself, so nothing here needs to be HTML-escaped.
 */
import { Audit } from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import type { Finding } from '@mridang/webhint-hint-plumbline/dist/lib/headers/finding.js';

/**
 * How a check's findings become a score. Mirrors Lighthouse's own scoring
 * modes for the three shapes the webhint checks take.
 */
export type ScoreMode = 'numeric' | 'binary' | 'informative';

/** Orders severities worst-first so the worst finding can lead the summary. */
const SEVERITY_RANK: Record<Finding['severity'], number> = {
  error: 0,
  warning: 1,
  hint: 2,
};

/** The table columns: one row per finding, severity then message. */
const HEADINGS: AuditNS.Details.TableColumnHeading[] = [
  { key: 'severity', valueType: 'text', label: 'Severity' },
  { key: 'message', valueType: 'text', label: 'Finding' },
];

/** The worst (most serious) finding, used for the one-line summary. */
function worstFinding(findings: readonly Finding[]): Finding | undefined {
  return [...findings].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  )[0];
}

/** Builds the detail table listing every finding. */
function detailsTable(findings: readonly Finding[]): AuditNS.Details.Table {
  return Audit.makeTableDetails(
    HEADINGS,
    findings.map((f) => ({ severity: f.severity, message: f.message })),
  );
}

/**
 * Builds the audit product from the findings a reused check returned, under
 * the given {@link ScoreMode} (defaulting to the graded `numeric` mapping).
 */
export function productFromFindings(
  findings: readonly Finding[],
  scoreMode: ScoreMode = 'numeric',
): AuditNS.Product {
  // An informative check never scores; it only surfaces whatever it found.
  if (scoreMode === 'informative') {
    if (findings.length === 0) {
      return { score: null, scoreDisplayMode: 'informative' };
    }
    return {
      score: null,
      scoreDisplayMode: 'informative',
      displayValue: worstFinding(findings)?.message,
      details: detailsTable(findings),
    };
  }

  if (findings.length === 0) {
    return { score: 1, scoreDisplayMode: scoreMode };
  }

  // Graded (`numeric`) checks distinguish a hard failure (any error) from
  // advice (only warnings/hints); pass/fail (`binary`) checks fail on anything.
  const hasError = findings.some((f) => f.severity === 'error');
  const score = scoreMode === 'binary' || hasError ? 0 : 0.5;

  return {
    score,
    scoreDisplayMode: scoreMode,
    displayValue: worstFinding(findings)?.message,
    details: detailsTable(findings),
  };
}

/**
 * The product for an audit whose data was absent from the run (for example a
 * devtools log with no document record). Lighthouse renders it greyed out and
 * excludes it from the category score.
 */
export function notApplicable(): AuditNS.Product {
  return {
    score: null,
    scoreDisplayMode: 'notApplicable',
    notApplicable: true,
  };
}
