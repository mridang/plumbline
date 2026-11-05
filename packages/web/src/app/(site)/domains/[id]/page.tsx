import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { repoPath } from '@/components/repos/repo-path';
import { RUNS_SHOWN } from '@/components/runs/run-history';
import { Container } from '@/components/ui/layout';
import { PageHeader } from '@/components/ui/page-header';
import { isDomainId } from '@/domain/api/domain-resource';
import { isRunId } from '@/domain/api/runs';
import { getDatabase } from '@/domain/db/client';
import { getDomain } from '@/domain/db/domains';
import { latestReport, listReports } from '@/domain/db/reports';
import { getRun, listRuns, runAsReport } from '@/domain/db/runs';
import { serverNow } from '@/lib/clock';
import { getCurrentUser } from '@/lib/core/auth/current-user';

import { SitePanel } from '@/app/(site)/repos/[owner]/[repo]/_components/site-panel';

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
  searchParams: Promise<{ report?: string }>;
}>): Promise<ReactElement> {
  const { id } = await params;
  const { report: picked } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(`/domains/${id}`)}`);
  }
  const db = getDatabase();
  const domain = isDomainId(id) ? await getDomain(db, user.id, id) : undefined;
  if (!domain) {
    notFound();
  }
  if (domain.repo) {
    const query = picked && isRunId(picked) ? `?report=${picked}` : '';
    redirect(`${repoPath(domain.repo)}${query}#site-${domain.id}`);
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
  return (
    <>
      <PageHeader eyebrow="Site" title={domain.host} />
      <Container className="pb-16">
        <SitePanel
          domain={domain}
          reports={reports}
          runs={runs}
          issues={[]}
          shown={shown}
          base={`/domains/${domain.id}`}
          now={serverNow()}
        />
      </Container>
    </>
  );
}
