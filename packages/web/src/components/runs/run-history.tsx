import type { ReactElement } from 'react';

import { repoPath } from '@/components/repos/repo-path';
import { Heading } from '@/components/ui/layout';
import { getDatabase } from '@/domain/db/client';
import { listDomains } from '@/domain/db/domains';
import { listRuns, type RunKind, type RunSummary } from '@/domain/db/runs';
import { getCurrentUser } from '@/lib/core/auth/current-user';
import { compareText, formatTimestamp } from '@/lib/intl';

/** The runs listed for each site. */
const SHOWN = 20;

/** How each kind of run is named. */
const KINDS: Readonly<Record<RunKind, string>> = {
  manual: 'Manual',
  deployment: 'Deployment',
  scheduled: 'Scheduled',
  config: 'Config change',
};

/** The colour of each kind's label: a person's own runs stand out from the server's. */
const KIND_TONES: Readonly<Record<RunKind, string>> = {
  manual: 'bg-flame text-ink',
  deployment: 'bg-ink/10 text-ink',
  scheduled: 'bg-ink/10 text-muted',
  config: 'bg-ink/10 text-ink',
};

/** A count, or a dash for one an older run did not keep. */
function countText(value: number | null, word: string): string {
  return value === null ? `– ${word}` : `${value} ${word}`;
}

/** The first seven characters of a commit, linked to it on GitHub. */
function Commit({
  repo,
  sha,
}: Readonly<{ repo: string; sha: string | null }>): ReactElement {
  if (sha === null) {
    return <span className="text-subtle">–</span>;
  }
  return (
    <a
      href={`https://github.com/${repo}/commit/${encodeURIComponent(sha)}`}
      className="focus-ring font-mono text-sm underline underline-offset-4"
    >
      {sha.slice(0, 7)}
    </a>
  );
}

/**
 * The runs of one site as a table: when, the commit, how the run started, how
 * its checks ended, and a link to open the report where the run kept one.
 * `base` is the address of the page the report links return to.
 */
export function RunList({
  repo,
  domainId,
  host,
  runs,
  base,
}: Readonly<{
  repo: string;
  domainId: string;
  host: string;
  runs: readonly RunSummary[];
  base: string;
}>): ReactElement {
  if (runs.length === 0) {
    return (
      <p className="mt-2 text-muted">
        No runs of {host} yet. Run the checks, or deploy.
      </p>
    );
  }
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-136 text-left text-sm">
        <caption className="sr-only">Runs of {host}, newest first</caption>
        <thead className="text-subtle">
          <tr>
            <th scope="col" className="py-2 pr-4 font-medium">
              When
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Commit
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Started by
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Result
            </th>
            <th scope="col" className="py-2 font-medium">
              <span className="sr-only">Report</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-field/60">
          {runs.map((run) => (
            <tr key={run.id}>
              <td className="py-2.5 pr-4 whitespace-nowrap tabular-nums">
                <time dateTime={run.ran_at}>{formatTimestamp(run.ran_at)}</time>
              </td>
              <td className="py-2.5 pr-4">
                <Commit repo={repo} sha={run.sha} />
              </td>
              <td className="py-2.5 pr-4">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${KIND_TONES[run.kind]}`}
                >
                  {KINDS[run.kind]}
                </span>
              </td>
              <td className="py-2.5 pr-4 whitespace-nowrap tabular-nums">
                <span className="font-semibold text-failed">
                  {countText(run.failed, 'failed')}
                </span>
                <span className="text-subtle">
                  {' · '}
                  {countText(run.warned, 'warned')}
                  {' · '}
                  {countText(run.passed, 'passed')}
                </span>
              </td>
              <td className="py-2.5 text-right">
                {run.openable ? (
                  <a
                    href={`${base}?report=${run.id}#site-${domainId}`}
                    className="focus-ring font-semibold underline underline-offset-4"
                  >
                    Open
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

/**
 * The history of a repository's sites, one list for each of the signed-in
 * person's sites among `hosts`: every run of its checks, whether the person
 * started it or a deployment, the daily re-check or a change to the rules did.
 * Meant for the repository's page; draws nothing for someone who is not signed
 * in or has none of the hosts.
 */
export async function RunHistory({
  repo,
  hosts,
}: Readonly<{
  repo: string;
  hosts: readonly string[];
}>): Promise<ReactElement | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  const db = getDatabase();
  const wanted = new Set(hosts);
  const sites = (await listDomains(db, user.id))
    .filter((domain) => wanted.has(domain.host))
    .toSorted((a, b) => compareText(a.host, b.host));
  if (sites.length === 0) {
    return null;
  }
  const lists = await Promise.all(
    sites.map(async (site) => ({
      site,
      runs: await listRuns(
        db,
        user.id,
        { domainId: site.id, host: site.host },
        SHOWN,
      ),
    })),
  );
  return (
    <section aria-labelledby="run-history">
      <Heading variant="h3" as="h2">
        <span id="run-history">Run history</span>
      </Heading>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Every run of the checks, newest first: the ones you start, and the ones
        a deployment, the daily re-check or a change to plumbline.yaml starts.
      </p>
      <div className="mt-6 space-y-8">
        {lists.map(({ site, runs }) => (
          <div key={site.id}>
            <h3 className="font-semibold break-all">{site.host}</h3>
            <RunList
              repo={repo}
              domainId={site.id}
              host={site.host}
              runs={runs}
              base={repoPath(repo)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
