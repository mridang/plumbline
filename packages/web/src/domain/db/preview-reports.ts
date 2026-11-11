/**
 * @packageDocumentation
 *
 * The reports behind the checks on pull requests. Each is stored under a
 * random id, which is the only way to find it, so the link in the check opens
 * the report without signing in and nobody else can list them. Reports older
 * than {@link KEEP_DAYS} are removed whenever a new one is saved, through the
 * `created_at` index.
 */

import { and, eq, lt } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { previewReports } from '@/domain/db/schema';
import type { StoredFinding } from '@/domain/suite/diff';
import { countsOf } from '@/domain/suite/report';

/** How long a report is kept, in days. */
export const KEEP_DAYS = 30;

/** A stored report. */
export interface PreviewReportRow {
  readonly id: string;
  readonly repo: string;
  readonly sha: string;
  readonly url: string;
  readonly errors: number;
  readonly warnings: number;
  readonly hints: number;
  readonly findings: readonly StoredFinding[];
  readonly created_at: string;
}

/** Keep a report and return its id; reports past their time are removed. */
export async function savePreviewReport(
  db: Database,
  report: Readonly<{
    repo: string;
    sha: string;
    url: string;
    findings: readonly StoredFinding[];
  }>,
  now = new Date(),
): Promise<string> {
  const id = crypto.randomUUID();
  const { errors, warnings, hints } = countsOf(report.findings);
  const inserted = db.insert(previewReports).values({
    id,
    repo: report.repo,
    sha: report.sha,
    url: report.url,
    errors,
    warnings,
    hints,
    findings: JSON.stringify(report.findings),
    created_at: now.toISOString(),
  });
  await inserted;
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000);
  await db
    .delete(previewReports)
    .where(lt(previewReports.created_at, cutoff.toISOString()));
  return id;
}

/**
 * The id of the report already made for this commit of this preview, or
 * undefined: the same commit is checked once, however many times its
 * deployment is reported.
 */
export async function reportOfCommit(
  db: Database,
  repo: string,
  sha: string,
  url: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ id: previewReports.id })
    .from(previewReports)
    .where(
      and(
        eq(previewReports.repo, repo),
        eq(previewReports.sha, sha),
        eq(previewReports.url, url),
      ),
    )
    .limit(1);
  return row?.id;
}

/** The report with this id, or undefined. */
export async function getPreviewReport(
  db: Database,
  id: string,
): Promise<PreviewReportRow | undefined> {
  const [row] = await db
    .select()
    .from(previewReports)
    .where(eq(previewReports.id, id))
    .limit(1);
  if (!row) {
    return undefined;
  }
  let findings: StoredFinding[] = [];
  try {
    const value: unknown = JSON.parse(row.findings);
    findings = Array.isArray(value) ? (value as StoredFinding[]) : [];
  } catch {
    findings = [];
  }
  return { ...row, findings };
}
