import Link from 'next/link';
import type { ReactElement } from 'react';

import { ChevronIcon } from '@/components/icons';
import { KINDS, RunList } from '@/components/runs/run-history';
import { POPOVER_ITEM, Popover } from '@/components/ui/popover';
import { Badge } from '@/components/ui-app/badge';
import { Count } from '@/components/ui-app/count';
import { RelativeTime } from '@/components/ui-app/relative-time';
import type { RunSummary } from '@/domain/db/runs';

/** The figures of a run, in the colours the results use: failed, warned and passed. */
function Counts({ run }: Readonly<{ run: RunSummary }>): ReactElement {
  const part = (
    value: number | null,
    word: string,
    colour: string,
  ): ReactElement => (
    <span className={value === null || value === 0 ? 'text-subtle' : colour}>
      {value === null ? '–' : <Count value={value} />}
      <span className="sr-only">
        {' '}
        {value === null ? `${word}: not kept` : word}
      </span>
    </span>
  );
  return (
    <span className="flex items-center gap-2 text-xs font-medium tabular-nums">
      {part(run.failed, 'failed', 'text-failed')}
      {part(run.warned, 'warned', 'text-warned')}
      {part(run.passed, 'passed', 'text-passed')}
    </span>
  );
}

/**
 * Which report of a site is shown, as one quiet control: the button says which
 * ("Latest · 2 hours ago · Manual") and opens the recent runs to pick another;
 * "Full history" under it holds the whole table, closed until asked for. So
 * many runs never push the results down the page.
 */
export function RunPicker({
  repo,
  host,
  runs,
  shownId,
  hrefFor,
  now,
}: Readonly<{
  repo: string;
  host: string;
  /** The site's runs, newest first. */
  runs: readonly RunSummary[];
  /** The run whose report is shown. */
  shownId: string | undefined;
  /** Where a run's report is shown. */
  hrefFor: (runId: string) => string;
  /** The server's clock when the page was made, in milliseconds. */
  now: number;
}>): ReactElement | null {
  if (runs.length === 0) {
    return null;
  }
  const latest = runs.find((run) => run.openable);
  const shown = runs.find((run) => run.id === shownId) ?? latest;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm font-medium text-muted">Report</p>
        {shown ? (
          <Popover
            label={`Choose a report of ${host}`}
            button={
              <>
                <span className="font-semibold">
                  {shown.id === latest?.id ? 'Latest' : 'Earlier'}
                </span>
                <span aria-hidden="true">·</span>
                <RelativeTime at={shown.ran_at} now={now} />
                <span aria-hidden="true">·</span>
                <Badge tone={KINDS[shown.kind].tone}>
                  {KINDS[shown.kind].label}
                </Badge>
                <ChevronIcon
                  size="sm"
                  className="text-subtle group-data-[state=open]:rotate-180 motion-safe:transition"
                />
              </>
            }
            buttonClassName="group focus-ring inline-flex h-9 items-center gap-2 rounded-control border border-field bg-surface px-3 text-sm hover:border-ink data-[state=open]:border-ink motion-safe:transition"
            panelClassName="w-[min(30rem,calc(100vw-2rem))] p-1.5"
          >
            <ul className="max-h-96 overflow-y-auto">
              {runs.map((run) => (
                <li key={run.id}>
                  {run.openable ? (
                    <Link
                      href={hrefFor(run.id)}
                      aria-current={run.id === shown.id ? 'true' : undefined}
                      className={`${POPOVER_ITEM} h-auto justify-between gap-3 py-2 ${run.id === shown.id ? 'bg-accent/8' : ''}`}
                    >
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <RelativeTime at={run.ran_at} now={now} />
                        <Badge tone={KINDS[run.kind].tone}>
                          {KINDS[run.kind].label}
                        </Badge>
                        {run.sha ? (
                          <span className="font-mono text-xs text-subtle">
                            {run.sha.slice(0, 7)}
                          </span>
                        ) : null}
                      </span>
                      <Counts run={run} />
                    </Link>
                  ) : (
                    <p className="flex min-h-10 items-center justify-between gap-3 px-3 py-2 text-sm text-subtle">
                      <span className="flex items-center gap-2">
                        <RelativeTime at={run.ran_at} now={now} />
                        <Badge>{KINDS[run.kind].label}</Badge>
                      </span>
                      <Counts run={run} />
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Popover>
        ) : (
          <p className="text-sm text-subtle">No run kept a report yet.</p>
        )}
      </div>
      <details className="group rounded-card border border-line bg-surface">
        <summary className="focus-ring-flush flex cursor-pointer items-center justify-between rounded-card px-4 py-2.5 text-sm font-medium hover:bg-ink/3">
          Full history
          <span className="flex items-center gap-2 text-xs font-normal text-subtle">
            {runs.length} {runs.length === 1 ? 'run' : 'runs'}
            <ChevronIcon
              size="sm"
              className="group-open:rotate-180 motion-safe:transition"
            />
          </span>
        </summary>
        <div className="border-t border-line p-3">
          <RunList
            repo={repo}
            host={host}
            runs={runs}
            hrefFor={hrefFor}
            shownId={shown?.id}
            now={now}
          />
        </div>
      </details>
    </div>
  );
}
