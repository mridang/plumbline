import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { ScanResults } from '@/components/scan/scan-results';
import { Container, Heading } from '@/components/ui/layout';
import { PageHeader } from '@/components/ui/page-header';
import { isDomainId } from '@/domain/api/domain-resource';
import { isReportId, reportResource } from '@/domain/api/report-resource';
import { CHECKS, enabledChecks } from '@/domain/checks/catalogue';
import { savedScan } from '@/domain/checks/saved-scan';
import { getDatabase } from '@/domain/db/client';
import { getDomain } from '@/domain/db/domains';
import { getReport, latestReport, listReports } from '@/domain/db/reports';
import { getCurrentUser } from '@/lib/core/auth/current-user';

import { CheckForm, type CheckSection } from './_components/check-form';
import { RemoveDomainButton } from './_components/remove-domain-button';
import { RunChecks } from './_components/run-checks';

export const dynamic = 'force-dynamic';

/** The tab title of a domain's page. */
export const metadata: Metadata = { title: 'Domain' };

/** Every check, grouped by report section in the report's own order. */
function sections(): CheckSection[] {
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
    .sort(([, a], [, b]) => a.order - b.order || a.title.localeCompare(b.title))
    .map(([id, group]) => ({ id, title: group.title, checks: group.checks }));
}

/**
 * One of the signed-in person's domains: run its checks (and save the report),
 * the saved reports with the newest (or the one picked) drawn in full, the
 * form that chooses which checks run, and a way to remove it. Someone who is
 * not signed in is sent to sign in; a domain that is not theirs is not found.
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
  const enabled = enabledChecks(domain.checks);
  const [reports, shown] = await Promise.all([
    listReports(db, user.id, domain.id, 20),
    picked && isReportId(picked)
      ? getReport(db, user.id, domain.id, picked)
      : latestReport(db, user.id, domain.id),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Domain"
        title={domain.host}
        intro={
          <>
            {enabled.length} of {CHECKS.length} checks run for this domain. They
            run in your browser, so the TLS and mail-server checks are skipped;
            run{' '}
            <code className="font-mono text-base">
              npx @mridang/plumbline scan {domain.host}
            </code>{' '}
            for every check.
          </>
        }
      >
        <div className="mt-8">
          <RunChecks domainId={domain.id} host={domain.host} checks={enabled} />
        </div>
      </PageHeader>

      <Container className="space-y-14 pb-16">
        <section>
          <Heading variant="h3">Saved reports</Heading>
          {reports.length === 0 ? (
            <p className="mt-3 text-muted">
              No reports yet. Run the checks to make one.
            </p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-2">
              {reports.map((report) => (
                <li key={report.id}>
                  <Link
                    href={`/domains/${domain.id}?report=${report.id}`}
                    aria-current={report.id === shown?.id ? 'true' : undefined}
                    className="focus-ring inline-flex h-9 items-center rounded-full border border-field px-4 text-sm tabular-nums hover:border-ink aria-current:border-ink aria-current:bg-ink aria-current:text-on-ink"
                  >
                    {report.created_at.slice(0, 16).replace('T', ' ')} ·{' '}
                    {report.failed} failed
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {shown ? (
            <ScanResults scan={savedScan(reportResource(shown))} />
          ) : null}
        </section>

        <section>
          <Heading variant="h3">Checks</Heading>
          <p className="mt-2 max-w-2xl text-muted">
            Choose which checks run for {domain.host}. With every check on,
            checks added to plumbline later run too.
          </p>
          <div className="mt-6">
            <CheckForm
              domainId={domain.id}
              sections={sections()}
              enabled={enabled}
            />
          </div>
        </section>

        <section>
          <Heading variant="h3">Remove</Heading>
          <p className="mt-2 mb-4 text-muted">
            Removing a domain also removes its saved reports.
          </p>
          <RemoveDomainButton domainId={domain.id} host={domain.host} />
        </section>
      </Container>
    </>
  );
}
