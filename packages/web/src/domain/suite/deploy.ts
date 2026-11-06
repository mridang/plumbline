/**
 * @packageDocumentation
 *
 * What a successful deployment on GitHub starts: the checks on each site found
 * in that repository, run by the scanner container and compared with the
 * previous run of the same site so a deployment that broke something (or fixed
 * it) is visible.
 *
 * A scan is the container's work and takes tens of seconds, so a handful of
 * sites are checked together and the rest are left for the next deployment.
 */

import type { Database } from '@/domain/db/client';
import { listDomainsOfRepo } from '@/domain/db/domains';
import {
  latestRuns,
  markTried,
  recordRun,
  type SuiteRunKind,
} from '@/domain/db/suite';
import {
  diffFindings,
  findingsOf,
  type Changes,
  type StoredFinding,
} from '@/domain/suite/diff';
import type { Live } from '@/domain/live/live';
import { countsOf } from '@/domain/suite/report';
import type { SuiteRun } from '@/domain/suite/run';
import { resolveRules } from '@/domain/suite/config';
import { FREE_LIMITS, inBatches, type Limits } from '@/domain/suite/limits';
import { SiteUnreachable } from '@/domain/suite/scanner';
import { applyLevels, fingerprintOf, type Level } from '@/domain/suite/rules';

/** Sites checked for one deployment on the Free plan. */
export const MAX_SITES = FREE_LIMITS.maxSites;

/** Environment names that are a preview, a staging copy or a review app, not the live site. */
const PREVIEW =
  /preview|staging|review|dev|pull[-_ ]?request|(^|[-_ ])pr[-_ ]?\d/i;

/** The parts of a `deployment_status` delivery the checks need. */
export interface DeploymentStatus {
  readonly deployment_status?: {
    readonly state?: string;
    readonly environment?: string;
    /** Where the deployed site can be reached. */
    readonly environment_url?: string;
    readonly target_url?: string;
  };
  readonly deployment?: {
    readonly sha?: string;
    readonly ref?: string;
    readonly environment?: string;
    /** GitHub's own flag for a deployment that is short-lived, as a preview of a branch is. */
    readonly transient_environment?: boolean;
  };
  readonly repository?: {
    readonly full_name?: string;
    readonly default_branch?: string;
  };
}

/** A successful deployment worth checking. */
export interface Deployment {
  /** The live site, or a preview of a branch or pull request. */
  readonly environment: 'production' | 'preview';
  readonly repo: string;
  readonly sha: string | null;
  /** The address the deployment says it can be reached at, when it says. */
  readonly url: string | null;
}

/** The address a delivery names, when it is a plain https address. */
function reachableAt(delivery: Readonly<DeploymentStatus>): string | null {
  const status = delivery.deployment_status;
  const given = status?.environment_url || status?.target_url;
  if (!given) {
    return null;
  }
  try {
    const url = new URL(given);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * What a `deployment_status` delivery is: null unless it reports a success.
 * It is a preview when GitHub marks the deployment as short-lived or the
 * environment is named like one (Preview, Staging, a review app, a pull
 * request), and the live site otherwise.
 */
export function classifyDeployment(
  delivery: Readonly<DeploymentStatus>,
): Deployment | null {
  const repo = delivery.repository?.full_name;
  if (delivery.deployment_status?.state !== 'success' || !repo) {
    return null;
  }
  const name =
    delivery.deployment_status.environment ??
    delivery.deployment?.environment ??
    '';
  const preview =
    delivery.deployment?.transient_environment === true || PREVIEW.test(name);
  return {
    environment: preview ? 'preview' : 'production',
    repo,
    sha: delivery.deployment?.sha ?? null,
    url: reachableAt(delivery),
  };
}

/** The levels of a site with no configuration. */
const DEFAULT_LEVELS = resolveRules(null, 'production').levels;

/** What a run of one site came to. */
export interface SiteOutcome {
  readonly host: string;
  /** Why nothing was checked, when that is so. */
  readonly skipped?: 'recent' | 'unreachable';
  /** True when the run found what the previous one did, under the same rules. */
  readonly unchanged?: boolean;
  readonly changes?: Changes;
  /** What the site has wrong now, under the rules of the run. */
  readonly findings?: readonly StoredFinding[];
  /** The checks that did not finish this time (they timed out). */
  readonly notRun?: readonly string[];
  /** The address that was checked. */
  readonly url?: string;
}

/** A run as stored, as {@link latestRuns} returns it. */
type StoredRun = Awaited<ReturnType<typeof latestRuns>>[number];

/** What the runs can be given in place of the real thing, for tests. */
export interface Deps {
  /** Scans a site and says what it found; throws when it cannot be scanned. */
  readonly run?: (url: string) => Promise<SuiteRun>;
  readonly now?: () => Date;
  /** The levels of the rules to apply; the recommended rules when not given. */
  readonly levels?: ReadonlyMap<string, Level>;
  /** Told as checks begin and end, for the live dashboard and notifications. */
  readonly live?: Live;
  /** What the Cloudflare plan allows; the Free plan's when not given. */
  readonly limits?: Limits;
  /** Check even a site that was checked a moment ago (its rules changed). */
  readonly force?: boolean;
  /** How the run started, kept with it; a deployment, or a config change when forced. */
  readonly kind?: SuiteRunKind;
}

/** Stands in for the scanner where none is given: a site cannot be scanned. */
const NO_SCANNER = (): Promise<SuiteRun> =>
  Promise.reject(new Error('No scanner is available.'));

/**
 * Check one site and store the run. The findings of a check the scanner could
 * not run this time (it timed out) are those of the previous run, so a slow
 * check does not make a problem look fixed and then found again.
 */
export async function checkSite(
  db: Database,
  userId: number,
  site: Readonly<{ host: string; repo: string | null; sha: string | null }>,
  deps: Deps = {},
  last?: StoredRun | null,
): Promise<SiteOutcome> {
  const run = deps.run ?? NO_SCANNER;
  const now = deps.now ?? (() => new Date());
  const levels = deps.levels ?? DEFAULT_LEVELS;
  const rules = await fingerprintOf(levels);
  // The caller may have read the previous run already; read it only if not.
  const previous =
    last === undefined
      ? (await latestRuns(db, userId, site.host, 1))[0]
      : (last ?? undefined);
  const url = `https://${site.host}/`;
  // The previous run is only a basis for this one if the rules are the same.
  const same = previous !== undefined && previous.rules === rules;
  const where = { host: site.host, repo: site.repo };
  const before = previous ? countsOf(previous.findings) : null;
  await deps.live?.started(userId, where, now().toISOString());
  let result: SuiteRun;
  try {
    result = await run(url);
  } catch (error) {
    console.error('suite run failed', site.host, error);
    if (error instanceof SiteUnreachable) {
      await markTried(db, userId, site.host, now().toISOString());
    }
    // Only a site that did not answer the scanner is told as down; a scanner
    // that was restarting or full is our trouble and must not alarm anyone.
    await deps.live?.finished(userId, where, {
      before,
      after: null,
      at: now().toISOString(),
      ...(error instanceof SiteUnreachable ? {} : { failed: true }),
    });
    return { host: site.host, skipped: 'unreachable' };
  }
  // What the previous run found stands for a check that did not run now, but
  // only under the rules it was found with.
  const carried =
    same && previous
      ? previous.findings.filter(
          (found) => result.skipped.includes(found.id) && levels.has(found.id),
        )
      : [];
  const findings = [
    ...findingsOf(applyLevels(result.checks, levels)),
    ...carried,
  ];
  const unchanged = same && previous.hash === result.hash;
  await recordRun(
    db,
    {
      userId,
      host: site.host,
      repo: site.repo,
      sha: site.sha,
      status: result.status,
      hash: result.hash,
      rules,
      findings,
      kind: deps.kind ?? (deps.force ? 'config' : 'deployment'),
      counts: result.counts,
      outcomes: result.outcomes,
    },
    now().toISOString(),
  );
  await deps.live?.finished(userId, where, {
    before,
    after: countsOf(findings),
    at: now().toISOString(),
  });
  return {
    host: site.host,
    unchanged,
    changes: diffFindings(previous?.findings ?? [], findings),
    findings,
    notRun: result.skipped,
    url,
  };
}

/** Check each site of the repository and store what was found. */
export async function checkDeployment(
  db: Database,
  userId: number,
  deployed: Readonly<{ repo: string; sha: string | null }>,
  deps: Deps = {},
): Promise<SiteOutcome[]> {
  const limits = deps.limits ?? FREE_LIMITS;
  const sites = (await listDomainsOfRepo(db, userId, deployed.repo)).slice(
    0,
    limits.maxSites,
  );
  // The sites are checked together: most of a check is waiting for the site.
  const outcomes = await inBatches(
    sites,
    limits.concurrency,
    async (site): Promise<SiteOutcome> => {
      const previous = (await latestRuns(db, userId, site.host, 1))[0];
      // A report is kept by commit: a commit that has been checked is not
      // checked again, however long ago, unless the rules changed (force). A
      // new commit is checked as soon as it is deployed.
      if (
        !deps.force &&
        deployed.sha !== null &&
        previous?.sha === deployed.sha
      ) {
        return { host: site.host, skipped: 'recent' };
      }
      return checkSite(
        db,
        userId,
        { host: site.host, repo: deployed.repo, sha: deployed.sha },
        deps,
        previous ?? null,
      );
    },
  );
  return outcomes;
}
