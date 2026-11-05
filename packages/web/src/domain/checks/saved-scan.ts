/**
 * @packageDocumentation
 *
 * A saved report put back into the shape the scan results view draws: each
 * stored outcome joined with what the list of checks says about its check
 * (name, description, section, reference, who fixes it, where it came from). A check that has since been
 * removed from the hints package is still shown, under its id.
 */

import type { HintOutcome } from '@/domain/scan/outcome';
import type { ReportResource } from '@/domain/api/report-resource';
import { findCheck } from '@/domain/checks/catalogue';

/** What the results view needs from a saved report. */
export interface SavedScan {
  readonly finalUrl: string;
  readonly total: number;
  readonly hints: readonly HintOutcome[];
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly savedAt: string;
}

/** The saved report as a finished scan, dated when it was made. */
export function savedScan(report: Readonly<ReportResource>): SavedScan {
  const at = Date.parse(report.created_at);
  const hints: HintOutcome[] = report.outcomes.map((outcome) => {
    const check = findCheck(outcome.id);
    return {
      id: outcome.id,
      name: check?.name ?? outcome.id,
      description: check?.description ?? '',
      ...(check?.reference ? { reference: check.reference } : {}),
      section: check?.section ?? 'other',
      sectionTitle: check?.section_title ?? 'Other',
      sectionOrder: check?.section_order ?? Number.MAX_SAFE_INTEGER,
      groups: check?.groups ?? [],
      ...(check?.fixer ? { fixer: check.fixer } : {}),
      origins: (check?.origins ?? []).map((origin) => ({
        source: origin.source,
        title: origin.title,
        url: origin.url,
        ...(origin.docs_url ? { docsUrl: origin.docs_url } : {}),
        summary: origin.summary,
      })),
      status: outcome.status,
      ...(outcome.reason !== undefined ? { reason: outcome.reason } : {}),
      findings: outcome.findings,
    };
  });
  return {
    finalUrl: report.url,
    total: hints.length,
    hints,
    startedAt: at,
    finishedAt: at,
    savedAt: report.created_at,
  };
}
