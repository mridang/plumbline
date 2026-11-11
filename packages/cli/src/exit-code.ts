import type { FailOn } from './options.js';

/** The statuses `plumbline` exits with. */
export const EXIT = {
  /** The command ran and nothing reached the `--fail-on` threshold. */
  ok: 0,
  /** The scan found something at or above the `--fail-on` threshold. */
  findings: 1,
  /** The command line was wrong; nothing was scanned. */
  usage: 2,
  /** The scan itself could not run (no browser, unreachable site, …). */
  failed: 3,
} as const;

/**
 * Webhint's severities from least to most serious, as the report names them.
 * `default` and `off` never appear on a finding.
 */
const RANK: Record<string, number> = {
  information: 1,
  hint: 2,
  warning: 3,
  error: 4,
};

/**
 * Decides the exit status of a scan: non-zero when any finding is at or above
 * the threshold, so a CI step fails on errors by default, on warnings with
 * `--fail-on warning`, and never with `--fail-on none`.
 * @param findings - The findings of the scan (only `severity` is read).
 * @param failOn - The lowest severity that fails the run.
 * @returns `EXIT.findings` or `EXIT.ok`.
 */
export function exitCodeFor(
  findings: readonly { severity: string }[],
  failOn: FailOn,
): number {
  if (failOn === 'none') {
    return EXIT.ok;
  }
  const threshold = RANK[failOn];
  const failed = findings.some((f) => (RANK[f.severity] ?? 0) >= threshold);
  return failed ? EXIT.findings : EXIT.ok;
}

/** Orders severities most serious first, for sorting findings. */
export function severityRank(severity: string): number {
  return RANK[severity] ?? 0;
}
