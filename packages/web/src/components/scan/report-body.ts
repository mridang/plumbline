/**
 * @packageDocumentation
 *
 * Turning a finished scan into the body `POST /api/domains/{id}/reports`
 * takes, and saving it. Only what the server stores goes: each check's id,
 * outcome, why it was skipped and what it found. The names, descriptions and
 * sections come back from the server's own list of checks when the report is
 * read.
 */

import { ensureOk } from '@/components/api/problem-message';

import type { Scan } from './scan-results';

/** One check's outcome, as the report takes it. */
export interface ReportOutcome {
  readonly id: string;
  readonly status: Scan['hints'][number]['status'];
  readonly reason?: string;
  readonly findings: Scan['hints'][number]['findings'];
}

/** The body of a report for a finished scan. */
export function reportBody(scan: Readonly<Scan>): {
  readonly url: string;
  readonly outcomes: readonly ReportOutcome[];
} {
  return {
    url: scan.finalUrl,
    outcomes: scan.hints.map((hint) => ({
      id: hint.id,
      status: hint.status,
      ...(hint.reason === undefined ? {} : { reason: hint.reason }),
      findings: hint.findings,
    })),
  };
}

/** Save a finished scan as a report of the domain; rejects with a `ProblemError` when it is refused. */
export async function saveReport(
  domainId: string,
  scan: Readonly<Scan>,
  transport: typeof fetch = (url, init) => fetch(url, init),
): Promise<void> {
  const response = await transport(`/api/domains/${domainId}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reportBody(scan)),
  });
  await ensureOk(response);
}
