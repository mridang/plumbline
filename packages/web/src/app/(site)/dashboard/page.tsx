import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { Container } from '@/components/ui/layout';
import { PageHeader } from '@/components/ui/page-header';
import { getDatabase } from '@/domain/db/client';
import { listHidden } from '@/domain/db/hidden';
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
 * from this page (`?hidden=1` lists the hidden ones again). Notifications, the
 * GitHub connection and connecting an assistant are in the account menu in the
 * header.
 */
export default async function DashboardPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ hidden?: string }>;
}>): Promise<ReactElement> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?returnTo=${encodeURIComponent('/dashboard')}`);
  }
  const { hidden } = await searchParams;
  const db = getDatabase();
  const [repos, hiddenRepos] = await Promise.all([
    overviewOf(db, user.id),
    listHidden(db, user.id),
  ]);
  const hiddenList = [...hiddenRepos].toSorted();
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Your sites"
        intro="Every repository and its sites, and how each stands right now. Checks show as they run."
      />
      <Container className="pb-16">
        {/* A fresh reading from the server starts the list again from it. */}
        <LiveOverview
          key={JSON.stringify([repos, hiddenList, hidden === '1'])}
          initial={repos}
          hidden={hiddenList}
          showHidden={hidden === '1'}
          now={serverNow()}
        />
      </Container>
    </>
  );
}
