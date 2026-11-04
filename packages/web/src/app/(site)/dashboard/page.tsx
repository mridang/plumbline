import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { Container } from '@/components/ui/layout';
import { PageHeader } from '@/components/ui/page-header';
import { NotificationSettings } from '@/components/notifications/notification-settings';
import { getDatabase } from '@/domain/db/client';
import { overviewOf } from '@/domain/db/live';
import { getCurrentUser } from '@/lib/core/auth/current-user';

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
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Your sites"
        intro="Every repository and site, and how each stands right now. Checks show as they run."
      />
      <Container className="pb-16">
        <LiveOverview initial={repos} />
        <div className="mt-12">
          <NotificationSettings />
        </div>
      </Container>
    </>
  );
}
