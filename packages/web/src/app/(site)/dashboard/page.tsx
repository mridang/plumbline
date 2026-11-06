import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { viewOf } from '@/components/repos/site-rows';
import { Container } from '@/components/ui/layout';
import { PageHeading } from '@/components/ui-app/page-heading';
import { getDatabase } from '@/domain/db/client';
import { disabledRepos } from '@/domain/db/disabled';
import { overviewOf } from '@/domain/db/live';
import { serverNow } from '@/lib/clock';
import { getCurrentUser } from '@/lib/core/auth/current-user';

import { LiveOverview } from './_components/live-overview';

export const dynamic = 'force-dynamic';

/** The tab title of the dashboard. */
export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Every repository of the signed-in person and how its sites stand, live: a
 * check shows as running while it runs and settles on its result when it ends,
 * with no refreshing. Repositories come from GitHub; the person can hide one
 * from this page (`?hidden=1` lists the hidden ones again), as a table or, with `?view=cards`, as cards. Notifications, the
 * GitHub connection and connecting an assistant are in the account menu in the
 * header.
 */
export default async function DashboardPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ view?: string }>;
}>): Promise<ReactElement> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?returnTo=${encodeURIComponent('/dashboard')}`);
  }
  const { view } = await searchParams;
  const db = getDatabase();
  const [repos, pausedRepos] = await Promise.all([
    overviewOf(db, user.id),
    disabledRepos(db, user.id),
  ]);
  const pausedList = [...pausedRepos].toSorted();
  return (
    <>
      <PageHeading
        eyebrow="Dashboard"
        title="Your sites"
        description="Every repository and its sites, and how each stands right now. Checks show as they run."
      />
      <Container className="py-6 sm:py-8">
        {/* A fresh reading from the server starts the list again from it. */}
        <LiveOverview
          key={JSON.stringify([repos, pausedList, viewOf(view)])}
          initial={repos}
          paused={pausedList}
          view={viewOf(view)}
          now={serverNow()}
        />
      </Container>
    </>
  );
}
