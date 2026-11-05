import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { StatusDot, worstState } from '@/components/repos/site-state';
import { repoPath } from '@/components/repos/repo-path';
import { RUNS_SHOWN } from '@/components/runs/run-history';
import { Section } from '@/components/ui-app/section';
import { CopyField } from '@/components/ui/copy-field';
import { Container } from '@/components/ui/layout';
import { PageHeader } from '@/components/ui/page-header';
import { repoOf } from '@/domain/api/hidden';
import { badgePath } from '@/domain/badge/sign';
import { getDatabase } from '@/domain/db/client';
import { issuesOf } from '@/domain/db/issue-history';
import { getDomain } from '@/domain/db/domains';
import { overviewOf } from '@/domain/db/live';
import { getRun, listRuns, runAsReport } from '@/domain/db/runs';
import { latestReport, listReports } from '@/domain/db/reports';
import { serverNow } from '@/lib/clock';
import { getCurrentUser } from '@/lib/core/auth/current-user';
import { getEnv } from '@/lib/core/runtime';
import { countOf } from '@/lib/intl';
import { SITE_URL } from '@/utils/site';

import { isRunId } from '@/domain/api/runs';

import { SitePanel } from './_components/site-panel';

export const dynamic = 'force-dynamic';

/** The tab title of a repository's page. */
export const metadata: Metadata = { title: 'Repository' };

/**
 * One repository of the signed-in person: its sites with how each stands, Run
 * checks, the saved reports and the choice of checks for each site they keep
 * (a site someone else's record holds shows how it stands only), and the badge
 * for the README. Someone not signed in is sent to sign in; a repository the
 * person cannot see is not found.
 */
export default async function RepoPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ report?: string }>;
}>): Promise<ReactElement> {
  const { owner, repo: name } = await params;
  const { report: picked } = await searchParams;
  const repo = repoOf(owner, name);
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `/auth/login?returnTo=${encodeURIComponent(repo ? repoPath(repo) : '/dashboard')}`,
    );
  }
  if (repo === null) {
    notFound();
  }
  const db = getDatabase();
  const entry = (await overviewOf(db, user.id)).find((r) => r.repo === repo);
  if (!entry) {
    notFound();
  }
  const panels = await Promise.all(
    entry.sites
      .filter((site) => site.mine)
      .map(async (site) => {
        const domain = await getDomain(db, user.id, site.id);
        if (!domain) {
          return null;
        }
        const [reports, runs, issues, run] = await Promise.all([
          listReports(db, user.id, domain.id, 20),
          listRuns(
            db,
            user.id,
            { domainId: domain.id, host: domain.host },
            RUNS_SHOWN,
          ),
          issuesOf(db, repo, domain.host),
          picked && isRunId(picked)
            ? getRun(
                db,
                user.id,
                { domainId: domain.id, host: domain.host },
                picked,
              )
            : undefined,
        ]);
        const shown = run ? runAsReport(run, domain.id) : undefined;
        return {
          domain,
          status: site,
          reports,
          runs,
          issues,
          shown: shown ?? (await latestReport(db, user.id, domain.id)),
        };
      }),
  );
  const others = entry.sites.filter((site) => !site.mine);
  const badgeImage = await badgePath(getEnv().SESSION_SECRET, repo);
  const badge = `[![Plumbline](${SITE_URL}${badgeImage})](${SITE_URL}${repoPath(repo)})`;
  const overall = worstState(entry.sites.map((site) => site.state));
  const now = serverNow();

  return (
    <>
      <PageHeader
        eyebrow="Repository"
        title={repo}
        intro={
          <span className="flex items-center gap-2">
            <StatusDot state={overall} />
            {countOf(entry.sites.length, 'site')} ·{' '}
            <a
              href={`https://github.com/${repo}`}
              className="focus-ring underline underline-offset-4"
            >
              View on GitHub
            </a>
          </span>
        }
      />
      <Container className="space-y-14 pb-16">
        <Section
          id="badge"
          title="Badge"
          description={`This is how it looks. Paste the Markdown into the README of ${repo} to show how its sites stand.`}
        >
          <div className="max-w-3xl">
            <div className="flex items-center rounded-card border border-line bg-surface p-5">
              <img
                src={badgeImage}
                alt={`Plumbline badge for ${repo}`}
                height={20}
              />
            </div>
            <div className="mt-3">
              <CopyField
                value={badge}
                label={`Markdown for the badge of ${repo}`}
              />
            </div>
          </div>
        </Section>

        {panels.map((panel) =>
          panel ? (
            <SitePanel
              key={panel.domain.id}
              domain={panel.domain}
              status={panel.status}
              reports={panel.reports}
              runs={panel.runs}
              issues={panel.issues}
              shown={panel.shown}
              base={repoPath(repo)}
              now={now}
            />
          ) : null,
        )}

        {others.length > 0 ? (
          <Section
            id="others"
            title="Other sites of this repository"
            description={`Kept by someone else with access to ${repo}; you see how they stand.`}
          >
            <ul className="divide-y divide-line rounded-card border border-line bg-surface px-4">
              {others.map((site) => (
                <li
                  key={site.id}
                  className="flex items-center gap-3 py-2.5 font-medium"
                >
                  <StatusDot state={site.state} />
                  <span className="break-all">{site.host}</span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </Container>
    </>
  );
}
