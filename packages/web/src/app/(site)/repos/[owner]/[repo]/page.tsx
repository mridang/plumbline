import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { RepoHeader } from '@/components/repos/repo-header';
import { repoPath } from '@/components/repos/repo-path';
import { siteHref } from '@/components/repos/site-href';
import { SiteView } from '@/components/repos/site-view';
import { STATES, StatusBadge, worstState } from '@/components/repos/site-state';
import { RUNS_SHOWN } from '@/components/runs/run-history';
import { Container } from '@/components/ui/layout';
import { Section } from '@/components/ui-app/section';
import { TabList, TabPanel } from '@/components/ui-app/tabs';
import { Dot } from '@/components/ui-app/status-dot';
import { repoOf } from '@/domain/api/repo-name';
import { isRunId } from '@/domain/api/runs';
import { badgePath } from '@/domain/badge/sign';
import { getDatabase } from '@/domain/db/client';
import { isRepoDisabled } from '@/domain/db/disabled';
import { issuesOf } from '@/domain/db/issue-history';
import { getDomain } from '@/domain/db/domains';
import { overviewOf } from '@/domain/db/live';
import { getRun, listRuns, runAsReport } from '@/domain/db/runs';
import { latestReport, listReports } from '@/domain/db/reports';
import { serverNow } from '@/lib/clock';
import { getCurrentUser } from '@/lib/core/auth/current-user';
import { getEnv } from '@/lib/core/runtime';
import { SITE_URL } from '@/utils/site';

export const dynamic = 'force-dynamic';

/** The tab title of a repository's page. */
export const metadata: Metadata = { title: 'Repository' };

/** The id of the panel the tabs open. */
const PANEL = 'site-panel';

/**
 * One repository of the signed-in person: a compact header with its badge and
 * its page on GitHub, then its sites, one tab for each when there are several
 * (`?site=host`, so a tab can be linked to), and under the tab the site's
 * report (`?report=id`, the newest by default) or, with `?view=settings`, the
 * choice of its checks. A site someone else's record holds shows how it stands
 * only. Someone not signed in is sent to sign in; a repository the person
 * cannot see is not found.
 */
export default async function RepoPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ site?: string; report?: string; view?: string }>;
}>): Promise<ReactElement> {
  const { owner, repo: name } = await params;
  const { site: pickedSite, report: picked, view } = await searchParams;
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
  // Only this repository's sites are read, and the pause flag is asked for in
  // the same round trip.
  const [overview, paused] = await Promise.all([
    overviewOf(db, user.id, serverNow(), repo),
    isRepoDisabled(db, repo),
  ]);
  const entry = overview.find((r) => r.repo === repo);
  if (!entry) {
    notFound();
  }
  const mine = entry.sites.filter((site) => site.mine);
  const current = mine.find((site) => site.host === pickedSite) ?? mine[0];
  const domain = current ? await getDomain(db, user.id, current.id) : undefined;
  const loaded = domain
    ? await (async () => {
        const [reports, runs, issues] = await Promise.all([
          listReports(db, user.id, domain.id, 1),
          listRuns(
            db,
            user.id,
            { domainId: domain.id, host: domain.host },
            RUNS_SHOWN,
          ),
          issuesOf(db, repo, domain.host),
        ]);
        // The report asked for, else the newest run that kept one.
        const wanted =
          picked && isRunId(picked)
            ? picked
            : runs.find((run) => run.openable)?.id;
        const run = wanted
          ? await getRun(
              db,
              user.id,
              { domainId: domain.id, host: domain.host },
              wanted,
            )
          : undefined;
        return {
          reports,
          runs,
          issues,
          shown: run
            ? runAsReport(run, domain.id)
            : await latestReport(db, user.id, domain.id),
        };
      })()
    : undefined;
  const others = entry.sites.filter((site) => !site.mine);
  const badgeImage = await badgePath(getEnv().SESSION_SECRET, repo);
  const badgeMarkdown = `[![Plumbline](${SITE_URL}${badgeImage})](${SITE_URL}${repoPath(repo)})`;
  const overall = worstState(entry.sites.map((site) => site.state));
  const now = serverNow();
  const settings = view === 'settings';

  return (
    <>
      <RepoHeader
        repo={repo}
        state={overall}
        paused={paused}
        siteCount={entry.sites.length}
        badgeImage={badgeImage}
        badgeMarkdown={badgeMarkdown}
      />
      <Container className="space-y-6 py-6">
        {domain && current && loaded ? (
          <>
            {mine.length > 1 ? (
              <TabList
                label="Sites of this repository"
                panelId={PANEL}
                current={current.host}
                tabs={mine.map((site) => ({
                  key: site.host,
                  href: siteHref(repo, site.host),
                  label: (
                    <>
                      <Dot
                        tone={STATES[site.state].kind}
                        pulse={site.state === 'running'}
                      />
                      {site.host}
                    </>
                  ),
                }))}
              />
            ) : null}
            {(() => {
              const view_ = (
                <SiteView
                  domain={domain}
                  status={current}
                  runs={loaded.runs}
                  issues={loaded.issues}
                  shown={loaded.shown}
                  view={settings ? 'settings' : 'results'}
                  hrefFor={(runId) =>
                    siteHref(repo, domain.host, { report: runId })
                  }
                  settingsHref={siteHref(repo, domain.host, {
                    view: 'settings',
                  })}
                  resultsHref={siteHref(repo, domain.host)}
                  lastRunAt={loaded.reports[0]?.created_at}
                  now={now}
                />
              );
              return mine.length > 1 ? (
                <TabPanel panelId={PANEL} current={current.host}>
                  {view_}
                </TabPanel>
              ) : (
                view_
              );
            })()}
          </>
        ) : null}

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
                  className="flex items-center justify-between gap-3 py-2.5 text-sm font-medium"
                >
                  <span className="truncate">{site.host}</span>
                  <StatusBadge state={site.state} />
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </Container>
    </>
  );
}
