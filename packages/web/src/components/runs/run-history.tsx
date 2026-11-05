import type { ReactElement } from 'react';

import type { Domain } from '@/domain/db/domains';
import type { RunKind, RunSummary } from '@/domain/db/runs';
import { formatTimestamp, relativeTime } from '@/lib/intl';

/** How each kind of run is named. */
const KINDS: Readonly<Record<RunKind, string>> = {
  manual: 'Manual',
  deployment: 'Deployment',
  scheduled: 'Scheduled',
  config: 'Config change',
};

/** The colour of each kind's label: a person's own runs stand out from the server's. */
const KIND_TONES: Readonly<Record<RunKind, string>> = {
  manual: 'bg-accent/10 text-accent',
  deployment: 'bg-ink/10 text-ink',
  scheduled: 'bg-ink/10 text-muted',
  config: 'bg-ink/10 text-ink',
};

/** One count: coloured when there is something to see, muted at zero, a dash for one an older run did not keep. */
function Count({
  value,
  word,
  tone,
}: Readonly<{
  value: number | null;
  word: string;
  tone: string;
}>): ReactElement {
  if (value === null) {
    return (
      <span className="text-subtle" title={`${word}: not kept for this run`}>
        –
      </span>
    );
  }
  return (
    <span
      className={value === 0 ? 'text-subtle' : `font-semibold ${tone}`}
      title={`${value} ${word}`}
    >
      {value}
      <span className="sr-only"> {word}</span>
    </span>
  );
}

/** The first seven characters of a commit, linked to it on GitHub. */
function Commit({
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

/** The column heads of a count, right-aligned over the numbers. */
const COUNT_HEAD = 'py-2 pr-4 text-right font-medium';

/**
 * The runs of one site as a table: when (as "2 hours ago", with the full time
 * on hover), the commit, how the run started, how many checks failed, warned
 * and passed, and a link to open the report where the run kept one. `base` is
 * the address of the page the report links return to; `shownId` marks the
 * report drawn on that page.
 */
export function RunList({
  repo,
  domainId,
  host,
  runs,
  base,
  shownId,
}: Readonly<{
  repo: string;
  domainId: string;
  host: string;
  runs: readonly RunSummary[];
  base: string;
  shownId?: string | undefined;
}>): ReactElement {
  if (runs.length === 0) {
    return (
      <p className="mt-2 text-muted">
        No runs of {host} yet. Press Run checks, or deploy, to make the first.
      </p>
    );
  }
  return (
    <div className="mt-3 overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-136 text-left text-sm">
        <caption className="sr-only">Runs of {host}, newest first</caption>
        <thead className="border-b border-line text-subtle">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              When
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Commit
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Started by
            </th>
            <th scope="col" className={COUNT_HEAD}>
              Failed
            </th>
            <th scope="col" className={COUNT_HEAD}>
              Warned
            </th>
            <th scope="col" className={COUNT_HEAD}>
              Passed
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              <span className="sr-only">Report</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {runs.map((run) => (
            <tr key={run.id} className={run.id === shownId ? 'bg-ink/5' : ''}>
              <td className="px-4 py-2.5 whitespace-nowrap">
                <time
                  dateTime={run.ran_at}
                  title={`${formatTimestamp(run.ran_at)} UTC`}
                >
                  {relativeTime(run.ran_at)}
                </time>
              </td>
              <td className="py-2.5 pr-4">
                <Commit repo={repo} sha={run.sha} />
              </td>
              <td className="py-2.5 pr-4">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${KIND_TONES[run.kind]}`}
                >
                  {KINDS[run.kind]}
                </span>
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums">
                <Count value={run.failed} word="failed" tone="text-failed" />
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums">
                <Count value={run.warned} word="warned" tone="text-warned" />
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums">
                <Count value={run.passed} word="passed" tone="text-passed" />
              </td>
              <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                {run.openable ? (
                  <a
                    href={`${base}?report=${run.id}#site-${domainId}`}
                    aria-current={run.id === shownId ? 'true' : undefined}
                    className="focus-ring rounded-sm font-semibold text-accent underline underline-offset-4 hover:text-ink"
                  >
                    {run.id === shownId ? 'Showing' : 'Open report'}
                  </a>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The runs listed for one site: the most recent ones. */
export const RUNS_SHOWN = 20;

/**
 * The runs of one of the signed-in person's sites: every run of its checks,
 * whether the person started it or a deployment, the daily re-check or a change
 * to the rules did. For a site's panel on its repository's page; the page reads
 * `runs` (see `listRuns`, `RUNS_SHOWN`).
 */
export function SiteRuns({
  repo,
  site,
  runs,
  base,
  shownId,
}: Readonly<{
  repo: string;
  site: Pick<Domain, 'id' | 'host'>;
  runs: readonly RunSummary[];
  base: string;
  shownId?: string | undefined;
}>): ReactElement {
  return (
    <div>
      <h4 className="text-sm font-semibold text-muted">Runs</h4>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Newest first: the ones you start, and the ones a deployment, the daily
        re-check or a change to plumbline.yaml starts.
      </p>
      <RunList
        repo={repo}
        domainId={site.id}
        host={site.host}
        runs={runs}
        base={base}
        shownId={shownId}
      />
    </div>
  );
}
