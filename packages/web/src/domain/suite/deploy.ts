/**
 * @packageDocumentation
 *
 * What a successful deployment on GitHub starts: the server-side checks on
 * each site found in that repository, compared with the previous run of the
 * same site so a deployment that broke something (or fixed it) is visible.
 *
 * A Worker invocation has 50 subrequests and, on the Free plan, 10 ms of CPU
 * (waiting for the site is not CPU). One run makes one request and reads the
 * page in one streaming pass, so a handful of sites fit in one delivery; the
 * rest are left for the next deployment.
 */

import type { Database } from '@/domain/db/client';
import { listDomainsOfRepo } from '@/domain/db/domains';
import { latestRuns, recordRun } from '@/domain/db/suite';
import { diffFindings, findingsOf, type Changes } from '@/domain/suite/diff';
import { runSuite, type SuiteRun } from '@/domain/suite/run';

/** Sites checked for one deployment. */
export const MAX_SITES = 5;

/** A site that was checked a moment ago is not checked again for this long, in milliseconds. */
export const DEBOUNCE_MS = 60_000;

/** The deployments that are not the live site. */
const PREVIEW = /preview|staging|dev/i;

/** The parts of a `deployment_status` delivery the checks need. */
export interface DeploymentStatus {
  readonly deployment_status?: {
    readonly state?: string;
    readonly environment?: string;
  };
  readonly deployment?: {
    readonly sha?: string;
    readonly environment?: string;
  };
  readonly repository?: { readonly full_name?: string };
}

/** The repository and commit of a deployment worth checking; null for anything else. */
export function liveDeployment(
  delivery: Readonly<DeploymentStatus>,
): { repo: string; sha: string | null } | null {
  const repo = delivery.repository?.full_name;
  if (delivery.deployment_status?.state !== 'success' || !repo) {
    return null;
  }
  const environment =
    delivery.deployment_status.environment ??
    delivery.deployment?.environment ??
    '';
  if (PREVIEW.test(environment)) {
    return null;
  }
  return { repo, sha: delivery.deployment?.sha ?? null };
}

/** What a run of one site came to. */
export interface SiteOutcome {
  readonly host: string;
  /** Why nothing was checked, when that is so. */
  readonly skipped?: 'recent' | 'unreachable';
  readonly changes?: Changes;
}

/** Check each site of the repository and store what was found. */
export async function checkDeployment(
  db: Database,
  userId: number,
  deployed: Readonly<{ repo: string; sha: string | null }>,
  deps: Readonly<{
    run?: (url: string) => Promise<SuiteRun>;
    now?: () => Date;
  }> = {},
): Promise<SiteOutcome[]> {
  const run = deps.run ?? ((url: string) => runSuite(url));
  const now = deps.now ?? (() => new Date());
  const sites = (await listDomainsOfRepo(db, userId, deployed.repo)).slice(
    0,
    MAX_SITES,
  );
  const outcomes: SiteOutcome[] = [];
  for (const site of sites) {
    const [previous] = await latestRuns(db, userId, site.host, 1);
    if (
      previous &&
      now().getTime() - Date.parse(previous.ran_at) < DEBOUNCE_MS
    ) {
      outcomes.push({ host: site.host, skipped: 'recent' });
      continue;
    }
    let result: SuiteRun;
    try {
      result = await run(`https://${site.host}/`);
    } catch (error) {
      console.error('suite run failed', site.host, error);
      outcomes.push({ host: site.host, skipped: 'unreachable' });
      continue;
    }
    const findings = findingsOf(result.checks);
    await recordRun(
      db,
      {
        userId,
        host: site.host,
        repo: deployed.repo,
        sha: deployed.sha,
        status: result.status,
        findings,
      },
      now().toISOString(),
    );
    outcomes.push({
      host: site.host,
      changes: diffFindings(previous?.findings ?? [], findings),
    });
  }
  return outcomes;
}
