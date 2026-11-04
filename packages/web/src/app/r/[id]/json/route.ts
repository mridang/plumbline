/**
 * A check's report as JSON, for tools (a coding agent that finds a failed
 * check on a pull request). Needs no sign-in: the random id in the address is
 * the key, and it is the one the check itself links to.
 *
 *   GET /r/{id}/json → 200 (404 for an id that is not one, or a report that was removed)
 */

import { findCheck } from '@/domain/checks/catalogue';
import { getDatabase } from '@/domain/db/client';
import { getPreviewReport } from '@/domain/db/preview-reports';

export const dynamic = 'force-dynamic';

/** The dynamic segment of the report address. */
interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

/** The report. */
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const report = await getPreviewReport(getDatabase(), id);
  if (!report) {
    return new Response(
      JSON.stringify({
        type: '/problems/not-found',
        title: 'Not found',
        status: 404,
      }),
      { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
    );
  }
  return Response.json(
    {
      version: 1,
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
        'Cache-Control': 'public, max-age=60',
        'X-Robots-Tag': 'noindex',
      },
    },
  );
}
