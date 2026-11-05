import type { ReactElement } from 'react';

import { Badge } from '@/components/ui-app/badge';
import { EmptyState } from '@/components/ui-app/empty-state';
import { RelativeTime } from '@/components/ui-app/relative-time';
import { CountCell } from '@/components/ui-app/stat';
import {
  Cell,
  HeadCell,
  Row,
  Table,
  TableBody,
  TableHead,
} from '@/components/ui-app/table';
import type { Tone } from '@/components/ui-app/tone';
import type { RunKind, RunSummary } from '@/domain/db/runs';

/** How each way a run starts is written. */
export const KINDS: Readonly<Record<RunKind, { label: string; tone: Tone }>> = {
  manual: { label: 'Manual', tone: 'info' },
  deployment: { label: 'Deployment', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'neutral' },
  config: { label: 'Config change', tone: 'neutral' },
};

/** A run's commit as a short monospace link to GitHub, or a dash when none is known. */
export function Commit({
  repo,
  sha,
}: Readonly<{ repo: string; sha: string | null }>): ReactElement {
  if (sha === null) {
    return (
      <span className="text-subtle" title="No commit is known for this run">
        –
      </span>
    );
  }
  return (
    <a
      href={`https://github.com/${repo}/commit/${encodeURIComponent(sha)}`}
      title={sha}
      className="focus-ring rounded-sm font-mono text-sm underline underline-offset-4 hover:text-accent"
    >
      {sha.slice(0, 7)}
    </a>
  );
}

/**
 * The runs of a site as a table, newest first: when (in words, the full time
 * on hover), the commit, how it started, the three counts and a link that opens
 * the run's report. The one being shown is tinted and says "Showing". `now` is
 * the server's clock, so the times read the same in the browser.
 */
export function RunList({
  repo,
  host,
  runs,
  hrefFor,
  shownId,
  now,
}: Readonly<{
  repo: string;
  host: string;
  runs: readonly RunSummary[];
  /** Where a run's report is shown. */
  hrefFor: (runId: string) => string;
  shownId?: string | undefined;
  now: number;
}>): ReactElement {
  if (runs.length === 0) {
    return (
      <EmptyState title={`No runs of ${host} yet`}>
        Press Run checks, or deploy, to make the first.
      </EmptyState>
    );
  }
  return (
    <Table caption={`Runs of ${host}, newest first`}>
      <TableHead>
        <tr>
          <HeadCell>When</HeadCell>
          <HeadCell>Commit</HeadCell>
          <HeadCell>Started by</HeadCell>
          <HeadCell align="end">Failed</HeadCell>
          <HeadCell align="end">Warned</HeadCell>
          <HeadCell align="end">Passed</HeadCell>
          <HeadCell align="end" hidden>
            Report
          </HeadCell>
        </tr>
      </TableHead>
      <TableBody>
        {runs.map((run) => (
          <Row key={run.id} current={run.id === shownId}>
            <Cell>
              <RelativeTime at={run.ran_at} now={now} />
            </Cell>
            <Cell>
              <Commit repo={repo} sha={run.sha} />
            </Cell>
            <Cell>
              <Badge tone={KINDS[run.kind].tone}>{KINDS[run.kind].label}</Badge>
            </Cell>
            <Cell align="end">
              <CountCell value={run.failed} word="failed" tone="bad" />
            </Cell>
            <Cell align="end">
              <CountCell value={run.warned} word="warned" tone="warn" />
            </Cell>
            <Cell align="end">
              <CountCell value={run.passed} word="passed" tone="good" />
            </Cell>
            <Cell align="end">
              {run.openable ? (
                <a
                  href={hrefFor(run.id)}
                  aria-current={run.id === shownId ? 'true' : undefined}
                  className="focus-ring rounded-sm font-semibold text-accent underline underline-offset-4 hover:text-ink"
                >
                  {run.id === shownId ? 'Showing' : 'Open report'}
                </a>
              ) : null}
            </Cell>
          </Row>
        ))}
      </TableBody>
    </Table>
  );
}

export const RUNS_SHOWN = 20;
