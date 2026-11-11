import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { siteHref } from '@/components/repos/site-href';
import { RUNS_SHOWN } from '@/components/runs/run-history';
import { SiteView } from '@/components/repos/site-view';
import { Container } from '@/components/ui/layout';
import { PageHeading } from '@/components/ui-app/page-heading';
import { isDomainId } from '@/domain/api/domain-resource';
import { isRunId } from '@/domain/api/runs';
import { getDatabase } from '@/domain/db/client';
import { getDomain } from '@/domain/db/domains';
import { latestReport, listReports } from '@/domain/db/reports';
import { getRun, listRuns, runAsReport } from '@/domain/db/runs';
import { serverNow } from '@/lib/clock';
import { getCurrentUser } from '@/lib/core/auth/current-user';

export const dynamic = 'force-dynamic';

/** The tab title of a domain's page. */
export const metadata: Metadata = { title: 'Domain' };

/**
 * The old address of a site's page. A site found in a repository now lives on
 * that repository's page, so this sends the person there (to the report they
 * asked for, if any); only a domain with no repository, added before sites
 * came from GitHub, is still shown here. Someone who is not signed in is sent
 * to sign in; a domain that is not theirs is not found.
 */
export default async function DomainPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<{ report?: string; view?: string }>;
}>): Promise<ReactElement> {
  const { id } = await params;
  const { report: picked, view } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    const returnTo = `/domains/${id}`;
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  const db = getDatabase();
  const domain = isDomainId(id) ? await getDomain(db, user.id, id) : undefined;
  if (!domain) {
    notFound();
  }
  if (domain.repo) {
    redirect(
      siteHref(domain.repo, domain.host, {
        report: picked && isRunId(picked) ? picked : undefined,
      }),
    );
  }
  const [reports, runs, shown] = await Promise.all([
    listReports(db, user.id, domain.id, 20),
    listRuns(
      db,
      user.id,
      { domainId: domain.id, host: domain.host },
      RUNS_SHOWN,
    ),
    picked && isRunId(picked)
      ? getRun(
          db,
          user.id,
          { domainId: domain.id, host: domain.host },
          picked,
        ).then((run) => (run ? runAsReport(run, domain.id) : undefined))
      : latestReport(db, user.id, domain.id),
  ]);
  const page = `/domains/${domain.id}`;
  return (
    <>
      <PageHeading eyebrow="Site" title={domain.host} />
      <Container className="py-6">
        <SiteView
          domain={domain}
          runs={runs}
          issues={[]}
          shown={shown}
          view={view === 'settings' ? 'settings' : 'results'}
          hrefFor={(runId) => `${page}?report=${runId}`}
          settingsHref={`${page}?view=settings`}
          resultsHref={page}
          lastRunAt={reports[0]?.created_at}
          now={serverNow()}
        />
      </Container>
    </>
  );
}
