/**
 * @packageDocumentation
 *
 * How the tools' answers are shaped: plain text for the model, and the
 * `structuredContent` the report and domain-list Views draw. Pure functions
 * over stored rows, so they are tested without a database.
 */

import { findCheck } from '@/domain/checks/catalogue';
import type { Domain } from '@/domain/db/domains';
import type { Report, ReportSummary } from '@/domain/db/reports';
import { reportResource } from '@/domain/api/report-resource';
import type {
  DomainListData,
  ReportData,
  ReportProblem,
  ReportTally,
} from '@/domain/mcp/ui-types';
import { SITE_URL } from '@/utils/site';

/** One piece of text in a tool result. */
export interface TextContent {
  readonly type: 'text';
  readonly text: string;
}

/** The result of a `tools/call`, as the protocol wants it. */
export interface ToolResult {
  /** What the model reads. */
  readonly content: readonly TextContent[];
  /** What the report or list view draws, for the tools that have one. */
  readonly structuredContent?: ReportData | DomainListData;
  /** True when the call failed in a way the assistant should relay. */
  readonly isError?: boolean;
}

/** A plain-text tool result. */
export function textResult(body: string): ToolResult {
  return { content: [{ type: 'text', text: body }] };
}

/** A plain-text tool result that tells the assistant the call did not work. */
export function errorResult(body: string): ToolResult {
  return { ...textResult(body), isError: true };
}

/** The page on plumbline that shows a domain and runs its checks. */
export function domainLink(domain: Readonly<Pick<Domain, 'id'>>): string {
  return `${SITE_URL}/domains/${domain.id}`;
}

/** The page on plumbline that lists the domains. */
export const DOMAINS_LINK = `${SITE_URL}/domains`;

/** The most findings of one check that go to the model and the View. */
const FINDINGS_SHOWN = 5;

/** The longest evidence snippet passed on. */
const SNIPPET_MAX = 400;

/** The four counts of a report, as a line. */
export function tallyLine(report: Readonly<ReportTally>): string {
  return `${report.failed} failed, ${report.warned} warned, ${report.passed} passed, ${report.skipped} skipped`;
}

/** The report View's data for a stored report: every check that failed or warned, failures first. */
export function reportData(
  domain: Readonly<Domain>,
  report: Readonly<Report>,
): ReportData {
  const outcomes = reportResource(report).outcomes;
  const problems: ReportProblem[] = (['failed', 'warned'] as const).flatMap(
    (status) =>
      outcomes
        .filter((o) => o.status === status)
        .map((o) => {
          const check = findCheck(o.id);
          return {
            id: o.id,
            name: o.name,
            status,
            findings: o.findings.slice(0, FINDINGS_SHOWN).map((f) => ({
              message: f.message,
              resource: f.resource,
              ...(f.snippet
                ? { snippet: f.snippet.slice(0, SNIPPET_MAX) }
                : {}),
            })),
            ...(check?.fixer ? { fixer: check.fixer } : {}),
            ...(check?.reference ? { reference: check.reference } : {}),
          };
        }),
  );
  return {
    host: domain.host,
    url: report.url,
    created_at: report.created_at,
    link: domainLink(domain),
    passed: report.passed,
    warned: report.warned,
    failed: report.failed,
    skipped: report.skipped,
    problems,
  };
}

/** What the model reads about a report: the tally, then each problem with its first findings. */
export function reportText(data: Readonly<ReportData>): string {
  const lines = [
    `Report for ${data.host} (${data.url}), scanned ${data.created_at}: ${tallyLine(data)}.`,
  ];
  for (const problem of data.problems) {
    lines.push(
      `\n${problem.status.toUpperCase()} ${problem.id}: ${problem.name}`,
    );
    for (const finding of problem.findings) {
      lines.push(`- ${finding.message} (${finding.resource})`);
      if (finding.snippet) {
        lines.push(`  ${finding.snippet.replaceAll(/\s+/g, ' ')}`);
      }
    }
    if (problem.fixer) {
      lines.push(`Usually fixed in: ${problem.fixer}.`);
    }
    if (problem.reference) {
      lines.push(`Rule: ${problem.reference}`);
    }
  }
  if (data.problems.length === 0) {
    lines.push('Nothing failed or warned.');
  }
  lines.push(`\nOpen it on Plumbline: ${data.link}`);
  return lines.join('\n');
}

/** A report result: text for the model, data for the View. */
export function reportResult(
  domain: Readonly<Domain>,
  report: Readonly<Report>,
): ToolResult {
  const data = reportData(domain, report);
  return { ...textResult(reportText(data)), structuredContent: data };
}

/** The domain list result: one line per domain for the model, data for the View. */
export function domainListResult(
  domains: readonly {
    readonly domain: Domain;
    readonly checks: number;
    readonly latest?: ReportSummary;
  }[],
  totalChecks: number,
): ToolResult {
  const data: DomainListData = {
    total_checks: totalChecks,
    link: DOMAINS_LINK,
    domains: domains.map(({ domain, checks, latest }) => ({
      id: domain.id,
      host: domain.host,
      checks,
      ...(latest
        ? {
            latest: {
              passed: latest.passed,
              warned: latest.warned,
              failed: latest.failed,
              skipped: latest.skipped,
              created_at: latest.created_at,
            },
          }
        : {}),
    })),
  };
  const text =
    domains.length === 0
      ? 'The user has no domains yet.'
      : domains
          .map(
            ({ domain, checks, latest }) =>
              `- ${domain.host}: ${checks} of ${totalChecks} checks; ${latest ? `newest scan ${latest.created_at}: ${tallyLine(latest)}` : 'not scanned yet'}`,
          )
          .join('\n');
  return { ...textResult(text), structuredContent: data };
}

/** The name of a check, or its id when it no longer exists. */
export function checkName(id: string): string {
  return findCheck(id)?.name ?? id;
}
