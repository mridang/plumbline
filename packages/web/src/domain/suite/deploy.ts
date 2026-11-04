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
import {
  diffFindings,
  findingsOf,
  type Changes,
  type StoredFinding,
} from '@/domain/suite/diff';
import { runSuite, type SuiteRun } from '@/domain/suite/run';
import { resolveRules } from '@/domain/suite/config';
import { FREE_LIMITS, inBatches, type Limits } from '@/domain/suite/limits';
import { applyLevels, fingerprintOf, type Level } from '@/domain/suite/rules';

/** Sites checked for one deployment on the Free plan. */
export const MAX_SITES = FREE_LIMITS.maxSites;

/** A site that was checked a moment ago is not checked again for this long, in milliseconds. */
export const DEBOUNCE_MS = 60_000;

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
  /** True when the page and the rules were the same as at the previous run, so it was not read again. */
  readonly unchanged?: boolean;
  readonly changes?: Changes;
  /** What the site has wrong now, under the rules of the run. */
  readonly findings?: readonly StoredFinding[];
  /** The address that was checked. */
  readonly url?: string;
}

/** A run as stored, as {@link latestRuns} returns it. */
type StoredRun = Awaited<ReturnType<typeof latestRuns>>[number];

/** What the runs can be given in place of the real thing, for tests. */
export interface Deps {
  readonly run?: (
    url: string,
    previousHash: string | null,
  ) => Promise<SuiteRun>;
  readonly now?: () => Date;
  /** The levels of the rules to apply; the recommended rules when not given. */
  readonly levels?: ReadonlyMap<string, Level>;
  /** What the Cloudflare plan allows; the Free plan's when not given. */
  readonly limits?: Limits;
  /** Check even a site that was checked a moment ago (its rules changed). */
  readonly force?: boolean;
}

/**
 * Check one site and store the run. A page that has not changed since the
 * previous run is not read again: the new run keeps the previous findings.
 */
export async function checkSite(
  db: Database,
  userId: number,
  site: Readonly<{ host: string; repo: string | null; sha: string | null }>,
  deps: Deps = {},
  last?: StoredRun | null,
): Promise<SiteOutcome> {
  const run = deps.run ?? ((url, hash) => runSuite(url, hash));
  const now = deps.now ?? (() => new Date());
  const levels = deps.levels ?? DEFAULT_LEVELS;
  const rules = await fingerprintOf(levels);
  // The caller may have read the previous run already; read it only if not.
  const previous =
    last === undefined
      ? (await latestRuns(db, userId, site.host, 1))[0]
      : (last ?? undefined);
  const url = `https://${site.host}/`;
  let result: SuiteRun;
  try {
    // A page that has not changed is only skipped when the rules have not either.
    result = await run(
      url,
      previous?.rules === rules ? (previous.hash ?? null) : null,
    );
  } catch (error) {
    console.error('suite run failed', site.host, error);
    return { host: site.host, skipped: 'unreachable' };
  }
  const unchanged = result.checks === null && previous !== undefined;
  const findings = result.checks
    ? findingsOf(applyLevels(result.checks, levels))
    : (previous?.findings ?? []);
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
    },
    now().toISOString(),
  );
  return {
    host: site.host,
    unchanged,
    changes: diffFindings(previous?.findings ?? [], findings),
    findings,
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
  const now = deps.now ?? (() => new Date());
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
      // The same commit again a moment later is the same deployment reported
      // twice; a different commit is a new deployment, whenever it comes.
      if (
        !deps.force &&
        previous &&
        previous.sha === deployed.sha &&
        now().getTime() - Date.parse(previous.ran_at) < DEBOUNCE_MS
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
