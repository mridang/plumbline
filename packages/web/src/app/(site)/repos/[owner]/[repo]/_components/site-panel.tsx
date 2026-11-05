import Link from 'next/link';
import type { ReactElement } from 'react';

import { STATES, StatusDot } from '@/components/repos/site-state';
import { ScanResults } from '@/components/scan/scan-results';
import { Heading } from '@/components/ui/layout';
import { CHECKS, enabledChecks } from '@/domain/checks/catalogue';
import { savedScan } from '@/domain/checks/saved-scan';
import { reportResource } from '@/domain/api/report-resource';
import type { Domain } from '@/domain/db/domains';
import type { SiteStatus } from '@/domain/db/live';
import type { Report, ReportSummary } from '@/domain/db/reports';
import { compareText } from '@/lib/intl';

import {
  CheckForm,
  type CheckSection,
} from '@/app/(site)/domains/[id]/_components/check-form';
import { RunChecks } from '@/app/(site)/domains/[id]/_components/run-checks';

/** Every check, grouped by report section in the report's own order. */
export function sections(): CheckSection[] {
  const bySection = new Map<
    string,
    { title: string; order: number; checks: CheckSection['checks'][number][] }
  >();
  for (const check of CHECKS) {
    const group = bySection.get(check.section) ?? {
      title: check.section_title,
      order: check.section_order,
      checks: [],
    };
    group.checks.push({
      id: check.id,
      name: check.name,
      description: check.description,
    });
    bySection.set(check.section, group);
  }
  return [...bySection.entries()]
    .sort(([, a], [, b]) => a.order - b.order || compareText(a.title, b.title))
    .map(([id, group]) => ({ id, title: group.title, checks: group.checks }));
}

/**
 * One site of a repository, for the person who owns its record: how it stands,
 * Run checks, the saved reports with the newest (or the one picked) drawn in
 * full, and the choice of which checks run. `base` is the address of the page
 * this panel is on, which the report links return to.
 */
export function SitePanel({
  domain,
  status,
  reports,
  shown,
  base,
}: Readonly<{
  domain: Domain;
  /** How the site stands now, when the dashboard knows. */
  status?: SiteStatus | undefined;
  reports: readonly ReportSummary[];
  /** The report drawn in full. */
  shown: Report | undefined;
  base: string;
}>): ReactElement {
  const enabled = enabledChecks(domain.checks);
  return (
    <section
      id={`site-${domain.id}`}
      aria-label={domain.host}
      className="scroll-mt-24"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <Heading variant="h3" as="h3">
            <span className="break-all">{domain.host}</span>
          </Heading>
          {status ? (
            <p
              className={`mt-1 flex items-center gap-2 text-sm font-semibold ${STATES[status.state].tone}`}
            >
              <StatusDot state={status.state} />
              {STATES[status.state].label}
            </p>
          ) : null}
        </div>
        <RunChecks
          domainId={domain.id}
          host={domain.host}
          checks={enabled}
          repository={domain.repo ?? undefined}
          lastRunAt={reports[0]?.created_at}
        />
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold text-muted">Saved reports</h4>
        {reports.length === 0 ? (
          <p className="mt-2 text-muted">
            No reports yet. Run the checks to make one.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {reports.map((report) => (
              <li key={report.id}>
                <Link
                  href={`${base}?report=${report.id}#site-${domain.id}`}
                  aria-current={report.id === shown?.id ? 'true' : undefined}
                  className="focus-ring inline-flex h-9 items-center rounded-full border border-field px-4 text-sm tabular-nums hover:border-ink aria-current:border-ink aria-current:bg-ink aria-current:text-on-ink"
                >
                  {report.created_at.slice(0, 16).replace('T', ' ')} ·{' '}
                  {report.failed} failed
                </Link>
              </li>
            ))}
          </ul>
        )}
        {shown ? (
          <ScanResults
            scan={savedScan(reportResource(shown))}
            repository={domain.repo ?? undefined}
          />
        ) : null}
      </div>

      <details className="mt-6 rounded-card border border-line bg-white p-5">
        <summary className="focus-ring cursor-pointer font-semibold">
          Choose the checks ({enabled.length} of {CHECKS.length} run for{' '}
          {domain.host})
        </summary>
        <p className="mt-2 max-w-2xl text-muted">
          With every check on, checks added to Plumbline later run too.
        </p>
        <div className="mt-6">
          <CheckForm
            domainId={domain.id}
            sections={sections()}
            enabled={enabled}
          />
        </div>
      </details>
    </section>
  );
}
