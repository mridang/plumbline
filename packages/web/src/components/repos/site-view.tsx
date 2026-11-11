import Link from 'next/link';
import type { ReactElement } from 'react';

import { LinkIcon } from '@/components/icons';
import { CheckForm, type CheckSection } from '@/components/repos/check-form';
import { SiteRunner } from '@/components/repos/site-runner';
import { RulesNote } from '@/components/repos/rules-note';
import { StatusBadge } from '@/components/repos/site-state';
import { commitUrl } from '@/components/repos/site-rows';
import { RunPicker } from '@/components/runs/run-picker';
import { issuesByCheck } from '@/components/scan/results';
import { ScanResults } from '@/components/scan/scan-results';
import { buttonClass } from '@/components/ui/button';
import { Badge } from '@/components/ui-app/badge';
import { EmptyState } from '@/components/ui-app/empty-state';
import { RelativeTime } from '@/components/ui-app/relative-time';
import { reportResource } from '@/domain/api/report-resource';
import { CHECKS, enabledChecks } from '@/domain/checks/catalogue';
import { savedScan } from '@/domain/checks/saved-scan';
import type { Domain } from '@/domain/db/domains';
import type { IssueRef } from '@/domain/db/issue-history';
import type { SiteStatus } from '@/domain/db/live';
import type { Report } from '@/domain/db/reports';
import type { RunSummary } from '@/domain/db/runs';
import { compareText } from '@/lib/intl';

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
    .toSorted(
      ([, a], [, b]) => a.order - b.order || compareText(a.title, b.title),
    )
    .map(([id, group]) => ({ id, title: group.title, checks: group.checks }));
}

/** What a site's tab says about the site: its address, how it stands, when it was checked and the commit. */
function Identity({
  domain,
  status,
  now,
}: Readonly<{
  domain: Domain;
  status: SiteStatus | undefined;
  now: number;
}>): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h2 className="min-w-0 text-lg font-semibold">
        <a
          href={`https://${domain.host}`}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring inline-flex items-center gap-1.5 break-all underline-offset-4 hover:underline"
        >
          {domain.host}
          <LinkIcon size="sm" className="shrink-0 text-subtle" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </h2>
      {status ? <StatusBadge state={status.state} size="md" /> : null}
      {status?.checked_at ? (
        <span className="text-sm text-muted">
          Checked{' '}
          <RelativeTime at={status.checked_at} now={now} className="text-ink" />
        </span>
      ) : null}
      {status?.sha && domain.repo ? (
        <a
          href={commitUrl(domain.repo, status.sha)}
          className="focus-ring rounded-full"
        >
          <Badge mono>{status.sha.slice(0, 7)}</Badge>
        </a>
      ) : null}
    </div>
  );
}

/**
 * One site, in the order a person reads it: who it is and Run checks; the totals
 * of the report being shown; the choice of report, with the whole history
 * closed beneath it; and the report, filtered and grouped, with the GitHub
 * issues under the checks they report. The choice of which checks run is a
 * view of its own (`view=settings`), not stacked under the results.
 */
export function SiteView({
  domain,
  status,
  runs,
  issues,
  shown,
  view,
  hrefFor,
  settingsHref,
  resultsHref,
  lastRunAt,
  now,
}: Readonly<{
  domain: Domain;
  /** How the site stands now, when the dashboard knows. */
  status?: SiteStatus;
  /** Its runs, newest first. */
  runs: readonly RunSummary[];
  /** The GitHub issues Plumbline opened for it, newest first. */
  issues: readonly IssueRef[];
  /** The report drawn in full. */
  shown: Report | undefined;
  view: 'results' | 'settings';
  /** Where a run's report is shown. */
  hrefFor: (runId: string) => string;
  /** Where the choice of checks is, and where the results are. */
  settingsHref: string;
  resultsHref: string;
  /** When the checks were last run by hand. */
  lastRunAt: string | undefined;
  /** The server's clock when the page was made, in milliseconds. */
  now: number;
}>): ReactElement {
  const enabled = enabledChecks(domain.checks);
  const byCheck = issuesByCheck(issues);
  const repo = domain.repo ?? undefined;
  const settings = view === 'settings';
  const savedPanel = (() => {
    if (settings) {
      return (
        <div className="rounded-card border border-line bg-surface p-5 shadow-xs">
          <h3 className="font-semibold">Checks that run for {domain.host}</h3>
          <p className="mt-1 mb-5 max-w-2xl text-sm text-pretty text-muted">
            With every check on, checks added to Plumbline later run too.
          </p>
          <CheckForm
            domainId={domain.id}
            sections={sections()}
            enabled={enabled}
          />
        </div>
      );
    }
    if (shown) {
      return (
        <>
          <ScanResults
            scan={savedScan(reportResource(shown))}
            repository={repo}
            issuesByCheck={byCheck}
            now={now}
            between={
              <RunPicker
                repo={domain.repo ?? ''}
                host={domain.host}
                runs={runs}
                shownId={shown.id}
                hrefFor={hrefFor}
                now={now}
              />
            }
          />
          {repo ? (
            <RulesNote repo={repo} checks={shown.outcomes.length} />
          ) : null}
        </>
      );
    }
    return (
      <>
        <RunPicker
          repo={domain.repo ?? ''}
          host={domain.host}
          runs={runs}
          shownId={undefined}
          hrefFor={hrefFor}
          now={now}
        />
        <EmptyState title="No report yet">
          Deploy the site or press Run checks: the first report covers the
          checks your rules turn on.
        </EmptyState>
        {repo ? <RulesNote repo={repo} /> : null}
      </>
    );
  })();

  return (
    <section aria-label={domain.host}>
      <SiteRunner
        domainId={domain.id}
        host={domain.host}
        checks={enabled}
        repository={repo}
        issuesByCheck={byCheck}
        lastRunAt={lastRunAt}
        identity={<Identity domain={domain} status={status} now={now} />}
        actions={
          <Link
            href={settings ? resultsHref : settingsHref}
            className={buttonClass({ variant: 'outline' })}
          >
            {settings
              ? 'Back to results'
              : `Choose checks (${enabled.length}/${CHECKS.length})`}
          </Link>
        }
        saved={savedPanel}
      />
    </section>
  );
}
