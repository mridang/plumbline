/**
 * What a check on a pull request found, as JSON, for tools (a coding agent that
 * finds a failed check on a pull request). Public: no sign-in is needed, and
 * the random id the check links to is the only key. A report is made once for a
 * commit and never changes, so it is kept by its id and never by age.
 *
 *   GET /api/previews/{id} → 200, 404 for an id that is not one or a report
 *   that was removed.
 */

import { problems } from '@/lib/core/api';
import { findCheck } from '@/domain/checks/catalogue';
import { getDatabase } from '@/domain/db/client';
import { getPreviewReport } from '@/domain/db/preview-reports';

export const dynamic = 'force-dynamic';

/** The dynamic segment of the address. */
interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

/** The ids reports are given: a random UUID. */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The report. */
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const report = ID.test(id)
    ? await getPreviewReport(getDatabase(), id)
    : undefined;
  if (!report) {
    return problems.notFound('preview');
  }
  return Response.json(
    {
      id: report.id,
      repo: report.repo,
      sha: report.sha,
      url: report.url,
      errors: report.errors,
      warnings: report.warnings,
      hints: report.hints,
      created_at: report.created_at,
      findings: report.findings.map((found) => ({
        id: found.id,
        name: findCheck(found.id)?.name ?? found.id,
        severity: found.severity,
        message: found.message,
        reference: findCheck(found.id)?.reference ?? null,
      })),
    },
    {
      headers: {
        // Made once for a commit and never changed: kept by id, never by age.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Robots-Tag': 'noindex',
      },
    },
  );
}
