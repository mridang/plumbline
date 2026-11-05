import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { pageMetadata } from '@/app/_metadata';
import { Badge } from '@/components/ui-app/badge';
import { Count } from '@/components/ui-app/count';
import { Section } from '@/components/ui-app/section';
import {
  Cell,
  HeadCell,
  Row,
  Table,
  TableBody,
  TableHead,
} from '@/components/ui-app/table';
import { Container } from '@/components/ui/layout';
import { PageHeader } from '@/components/ui/page-header';
import { CHECKS, SECTIONS, type Check } from '@/domain/checks/catalogue';

/** A public page: it may be indexed. */
export const metadata: Metadata = pageMetadata({
  title: 'Checks',
  description:
    'Every check Plumbline runs on a site: security headers, TLS, DNS and email, privacy, SEO, social cards and agent readiness, with where each rule comes from.',
  path: '/checks',
  index: true,
});

/** The names of the places a check was taken from, once each. */
function sourcesOf(check: Check): string[] {
  return [...new Set(check.origins.map((origin) => origin.source))];
}

/**
 * Every check, by report section: its name and id (the id is what a
 * `plumbline.yaml` turns on or off), what it looks at, and where the rule
 * comes from. The page is the same for everyone.
 */
export default function ChecksPage(): ReactElement {
  const sections = SECTIONS.map((section) => ({
    section,
    checks: CHECKS.filter((check) => check.section === section.id),
  })).filter((entry) => entry.checks.length > 0);
  return (
    <>
      <PageHeader
        eyebrow="Checks"
        title="Everything Plumbline looks at"
        intro={
          <>
            <Count value={CHECKS.length} /> checks in {sections.length} areas.
            Each is ported from a public reference with its rules and wording
            kept; the id beside a check is what a rules file turns on or off.
          </>
        }
      >
        <nav aria-label="Areas" className="mt-6 flex flex-wrap gap-2">
          {sections.map(({ section, checks }) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="focus-ring inline-flex h-9 items-center gap-2 rounded-full border border-field bg-surface px-4 text-sm font-medium transition hover:border-ink"
            >
              {section.title}
              <span className="text-subtle tabular-nums">{checks.length}</span>
            </a>
          ))}
        </nav>
      </PageHeader>
      <Container className="space-y-14 pt-10 pb-20">
        {sections.map(({ section, checks }) => (
          <Section
            key={section.id}
            id={section.id}
            title={section.title}
            description={`${section.description} Fixes usually come from ${section.fixer.toLowerCase()}.`}
            actions={
              <Badge tone="info">
                <Count value={checks.length} />{' '}
                {checks.length === 1 ? 'check' : 'checks'}
              </Badge>
            }
          >
            <Table caption={`Checks in ${section.title}`} minWidth="min-w-176">
              <TableHead>
                <tr>
                  <HeadCell>Check</HeadCell>
                  <HeadCell>What it looks at</HeadCell>
                  <HeadCell>From</HeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {checks.map((check) => (
                  <Row key={check.id}>
                    <Cell nowrap={false}>
                      <span className="block font-medium">{check.name}</span>
                      <code className="mt-0.5 block font-mono text-xs break-all text-subtle">
                        {check.id}
                      </code>
                    </Cell>
                    <Cell nowrap={false}>
                      <span className="text-pretty text-muted">
                        {check.description}
                      </span>
                    </Cell>
                    <Cell nowrap={false}>
                      <span className="flex flex-wrap gap-1.5">
                        {sourcesOf(check).map((source) => (
                          <Badge key={source}>{source}</Badge>
                        ))}
                      </span>
                    </Cell>
                  </Row>
                ))}
              </TableBody>
            </Table>
          </Section>
        ))}
      </Container>
    </>
  );
}
