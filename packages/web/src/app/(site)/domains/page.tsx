import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { Card } from '@/components/ui/card';
import { Container } from '@/components/ui/layout';
import { PageHeader } from '@/components/ui/page-header';
import { CHECKS, enabledChecks } from '@/domain/checks/catalogue';
import { getDatabase } from '@/domain/db/client';
import { MAX_DOMAINS, listDomains } from '@/domain/db/domains';
import { listReports } from '@/domain/db/reports';
import { getCurrentUser } from '@/lib/core/auth/current-user';

import { AddDomainForm } from './_components/add-domain-form';

export const dynamic = 'force-dynamic';

/** The tab title of the domains page. */
export const metadata: Metadata = { title: 'Your domains' };

/**
 * The signed-in person's domains: a box to add one, and each domain with how
 * many checks run for it and how its newest scan went. Anyone not signed in is
 * sent to sign in and brought straight back here.
 */
export default async function DomainsPage(): Promise<ReactElement> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?returnTo=${encodeURIComponent('/domains')}`);
  }
  const db = getDatabase();
  const domains = await listDomains(db, user.id);
  const rows = await Promise.all(
    domains.map(async (domain) => ({
      domain,
      checks: enabledChecks(domain.checks).length,
      latest: (await listReports(db, user.id, domain.id, 1))[0],
    })),
  );

  return (
    <>
      <PageHeader
        eyebrow="Domains"
        title="Your domains"
        intro={`Keep up to ${MAX_DOMAINS} domains, choose which checks run for each, and keep their reports.`}
      >
        <div className="mt-8 max-w-2xl">
          <AddDomainForm />
        </div>
      </PageHeader>
      <Container className="pb-16">
        {rows.length === 0 ? (
          <p className="text-muted">No domains yet. Add one above.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {rows.map(({ domain, checks, latest }) => (
              <li key={domain.id}>
                <Card padding="lg" className="h-full">
                  <Link
                    href={`/domains/${domain.id}`}
                    className="focus-ring text-lg font-semibold break-all underline-offset-4 hover:underline"
                  >
                    {domain.host}
                  </Link>
                  <p className="mt-1 text-sm text-subtle">
                    {checks} of {CHECKS.length} checks
                    {domain.repo ? ` · ${domain.repo}` : ''}
                  </p>
                  <p className="mt-3 text-sm">
                    {latest ? (
                      <>
                        <span className="font-semibold text-failed">
                          {latest.failed} failed
                        </span>
                        {' · '}
                        <span className="font-semibold text-warned">
                          {latest.warned} warned
                        </span>
                        {' · '}
                        <span className="text-passed">
                          {latest.passed} passed
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">Not scanned yet</span>
                    )}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
