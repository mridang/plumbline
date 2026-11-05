import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { CopyField } from '@/components/ui/copy-field';
import { Container } from '@/components/ui/layout';
import { PageHeader } from '@/components/ui/page-header';
import { NotificationSettings } from '@/components/notifications/notification-settings';
import { badgePath } from '@/domain/badge/sign';
import { getDatabase } from '@/domain/db/client';
import { overviewOf } from '@/domain/db/live';
import { getCurrentUser } from '@/lib/core/auth/current-user';
import { getEnv } from '@/lib/core/runtime';
import { SITE_URL } from '@/utils/site';

import { LiveOverview } from './_components/live-overview';

export const dynamic = 'force-dynamic';

/** The tab title of the dashboard. */
export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Every repository and site of the signed-in person and how each stands, live:
 * a check shows as running while it runs and settles on its result when it
 * ends, with no refreshing. Notifications for changes can be turned on below.
 */
export default async function DashboardPage(): Promise<ReactElement> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?returnTo=${encodeURIComponent('/dashboard')}`);
  }
  const repos = await overviewOf(getDatabase(), user.id);
  const secret = getEnv().SESSION_SECRET;
  const badges = await Promise.all(
    repos
      .filter((entry) => entry.repo !== null)
      .map(async (entry) => {
        const repo = entry.repo as string;
        const url = `${SITE_URL}${await badgePath(secret, repo)}`;
        return {
          repo,
          markdown: `[![Plumbline](${url})](${SITE_URL}/dashboard)`,
        };
      }),
  );
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Your sites"
        intro="Every repository and site, and how each stands right now. Checks show as they run."
      />
      <Container className="pb-16">
        {/* A fresh reading from the server starts the list again from it. */}
        <LiveOverview key={JSON.stringify(repos)} initial={repos} />
        {badges.length > 0 ? (
          <section aria-labelledby="badges" className="mt-12 max-w-3xl">
            <h2 id="badges" className="text-lg font-semibold">
              Badges
            </h2>
            <p className="mt-1 text-sm text-muted">
              Paste one into the README of a repository to show how its sites
              stand.
            </p>
            <ul className="mt-4 space-y-3">
              {badges.map(({ repo, markdown }) => (
                <li key={repo}>
                  <p className="mb-1 text-sm font-medium">{repo}</p>
                  <CopyField value={markdown} label={`Badge for ${repo}`} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <div className="mt-12">
          <NotificationSettings />
        </div>
      </Container>
    </>
  );
}
