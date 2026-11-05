import type { ReactElement } from 'react';

import { STATES, StatusDot } from '@/components/repos/site-state';
import { SiteRuns } from '@/components/runs/run-history';
import { issuesByCheck } from '@/components/scan/results';
import { ScanResults } from '@/components/scan/scan-results';
import type { IssueRef } from '@/domain/db/issue-history';
import { Heading } from '@/components/ui/layout';
import { CHECKS, enabledChecks } from '@/domain/checks/catalogue';
import { savedScan } from '@/domain/checks/saved-scan';
import { reportResource } from '@/domain/api/report-resource';
import type { Domain } from '@/domain/db/domains';
import type { SiteStatus } from '@/domain/db/live';
import type { Report, ReportSummary } from '@/domain/db/reports';
import type { RunSummary } from '@/domain/db/runs';
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
  runs,
  issues,
  shown,
  base,
}: Readonly<{
  domain: Domain;
  /** How the site stands now, when the dashboard knows. */
  status?: SiteStatus | undefined;
  reports: readonly ReportSummary[];
  /** Its runs, newest first. */
  runs: readonly RunSummary[];
  /** The GitHub issues Plumbline opened for it, newest first. */
  issues: readonly IssueRef[];
  /** The report drawn in full. */
  shown: Report | undefined;
  base: string;
}>): ReactElement {
  const enabled = enabledChecks(domain.checks);
  const byCheck = issuesByCheck(issues);
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
          issuesByCheck={byCheck}
          lastRunAt={reports[0]?.created_at}
        />
      </div>

      <div className="mt-6">
        <SiteRuns
          repo={domain.repo ?? ''}
          site={domain}
          runs={runs}
          base={base}
          shownId={shown?.id}
        />
        {shown ? (
          <ScanResults
            scan={savedScan(reportResource(shown))}
            repository={domain.repo ?? undefined}
            issuesByCheck={byCheck}
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
