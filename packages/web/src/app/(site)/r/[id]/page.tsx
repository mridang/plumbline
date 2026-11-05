import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { Card } from '@/components/ui/card';
import { Container } from '@/components/ui/layout';
import { PageHeader } from '@/components/ui/page-header';
import { findCheck } from '@/domain/checks/catalogue';
import { getDatabase } from '@/domain/db/client';
import { getPreviewReport } from '@/domain/db/preview-reports';

export const dynamic = 'force-dynamic';

/** The report is for whoever has its link, and is not for search engines. */
export const metadata: Metadata = {
  title: 'Report',
  robots: { index: false, follow: false },
};

/** The dynamic segment of the report address. */
interface Props {
  readonly params: Promise<{ readonly id: string }>;
}

/** The colour of each severity. */
const TONES = {
  error: 'text-failed',
  warning: 'text-warned',
  hint: 'text-muted',
} as const;

/**
 * What a check on a pull request found, as a page that needs no sign-in: the
 * link in the check opens it. The same report is at `/api/previews/{id}` for tools.
 */
export default async function ReportPage({
  params,
}: Props): Promise<ReactElement> {
  const { id } = await params;
  const report = await getPreviewReport(getDatabase(), id);
  if (!report) {
    notFound();
  }
  const byRule = Map.groupBy(report.findings, (found) => found.id);
  return (
    <>
      <PageHeader
        eyebrow={report.repo}
        title={`${report.errors} errors, ${report.warnings} warnings, ${report.hints} hints`}
        intro={`Checked ${report.url} at commit ${report.sha.slice(0, 7)}.`}
      />
      <Container className="pb-16">
        {report.findings.length === 0 ? (
          <p className="text-muted">Nothing found.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4">
            {[...byRule].map(([rule, found]) => {
              const check = findCheck(rule);
              return (
                <li key={rule}>
                  <Card padding="lg">
                    <h2 className="text-lg font-semibold">
                      {check?.name ?? rule}{' '}
                      <span className="text-sm font-normal text-subtle">
                        {rule}
                      </span>
                    </h2>
                    {check?.reference ? (
                      <a
                        href={check.reference}
                        rel="noreferrer noopener"
                        className="focus-ring text-sm underline underline-offset-4"
                      >
                        Why it matters
                      </a>
                    ) : null}
                    <ul className="mt-3 space-y-1 text-sm">
                      {found.map((item, at) => (
                        <li key={at}>
                          <span
                            className={`font-semibold ${TONES[item.severity]}`}
                          >
                            {item.severity}
                          </span>
                          : {item.message}
                        </li>
                      ))}
                    </ul>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </>
  );
}
