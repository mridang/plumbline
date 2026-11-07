/**
 * @packageDocumentation
 *
 * What a successful deployment on GitHub starts. The repository's
 * `plumbline.yaml` is read at the deployed commit to find the rules; the
 * scanner container runs every check, and the rules say which count. A live
 * site is checked as its registered domains and each check that finds a problem
 * has an issue of its own; a preview is checked at the address the deployment
 * names and the findings go to a check run on the commit, which GitHub shows
 * on the pull request. Nothing here may fail the delivery: a problem reaching
 * GitHub is logged and the run goes on with the default rules.
 */

import {
  disableRepoByFile,
  enableRepoByFile,
  isRepoFileDisabled,
  isRepoSwitchedOff,
  stopChecking,
} from '@/domain/db/disabled';
import { parseHost } from '@/domain/api/domain-resource';
import type { Database } from '@/domain/db/client';
import { clearGap, noteGap } from '@/domain/db/deploy-gaps';
import { listDomainsOfRepo } from '@/domain/db/domains';
import { latestRuns } from '@/domain/db/suite';
import { GitHubApi, GitHubError, TooLargeError } from '@/domain/github/api';
import { reportOfCommit, savePreviewReport } from '@/domain/db/preview-reports';
import { installationToken } from '@/domain/github/app-auth';
import type { GitHubConfig } from '@/domain/github/config';
import {
  CONFIG_FILES,
  parseConfig,
  resolveRules,
  type LoadedConfig,
  type ResolvedRules,
} from '@/domain/suite/config';
import {
  checkDeployment,
  type Deployment,
  type Deps,
} from '@/domain/suite/deploy';
import { findingsOf, type StoredFinding } from '@/domain/suite/diff';
import {
  closeUndeployed,
  newBudget,
  noteDeferred,
  originOf,
  pauseBetweenWrites,
  publishCheckRun,
  publishUnreachable,
  syncIssues,
} from '@/domain/suite/publish';
import { dispatchRun } from '@/domain/suite/dispatch';
import { applyLevels } from '@/domain/suite/rules';
import {
  baselineHost,
  compareWithBaseline,
  type Comparison,
} from '@/domain/suite/baseline';
import { matchesAny } from '@/domain/suite/glob';
import { siteAddress } from '@/domain/suite/site-address';
import { reconcileSites } from '@/domain/github/sites';

/** What the work can be given in place of the real thing, for tests. */
export interface RunDeps extends Deps {
  readonly fetcher?: typeof fetch;
  /** The app's public origin, for the link in a check to its report; no report is kept without it. */
  readonly appUrl?: string;
  /** Waits between two writes to GitHub; a short pause when not given. */
  readonly pause?: () => Promise<void>;
}

/** The longest configuration file that is read; a real one is a few lines. */
export const CONFIG_MAX_BYTES = 32 * 1024;

/**
 * The repository's configuration file at `ref`. The first of the file names
 * that exists wins; none is not a problem. Any other failure to read it is
 * returned as a sentence, so the rules can say they are the defaults.
 */
export async function loadConfig(
  api: GitHubApi,
  repo: string,
  ref: string,
): Promise<{ loaded: LoadedConfig | null; unreadable: string | null }> {
  for (const name of CONFIG_FILES) {
    try {
      return {
        loaded: parseConfig(
          await api.file(repo, name, ref, CONFIG_MAX_BYTES),
          name,
        ),
        unreadable: null,
      };
    } catch (error) {
      if (error instanceof GitHubError && error.status === 404) {
        continue;
      }
      if (error instanceof TooLargeError) {
        return {
          loaded: null,
          unreadable: `${name} is longer than ${CONFIG_MAX_BYTES / 1024} KB, so it was ignored and the default rules were used.`,
        };
      }
      return {
        loaded: null,
        unreadable: `${name} could not be read from GitHub (${error instanceof Error ? error.message : String(error)}), so the default rules were used.`,
      };
    }
  }
  return { loaded: null, unreadable: null };
}

/** The rules of a deployment, whether they were read from the file, and what the live site's rules ask for. */
type DeploymentRules = ResolvedRules & {
  readonly read: boolean;
  /** The checks the live site's rules ask for, to tell which findings of a preview can be compared with it. */
  readonly liveChecks: ReadonlySet<string>;
};

/** The rules for a deployment: those in the repository's file at that commit, or the defaults. */
async function rulesFor(
  api: GitHubApi | null,
  deployed: Readonly<Deployment>,
): Promise<DeploymentRules> {
  if (!api || !deployed.sha) {
    return {
      ...resolveRules(null, deployed.environment),
      read: false,
      liveChecks: new Set(resolveRules(null, 'production').levels.keys()),
    };
  }
  const { loaded, unreadable } = await loadConfig(
    api,
    deployed.repo,
    deployed.sha,
  );
  const rules = resolveRules(loaded, deployed.environment);
  const liveChecks = new Set(resolveRules(loaded, 'production').levels.keys());
  // `read` is false when the file could not be read, so what it says is not known.
  return unreadable
    ? {
        ...rules,
        problems: [...rules.problems, unreadable],
        read: false,
        liveChecks,
      }
    : { ...rules, read: true, liveChecks };
}

/**
 * Settles the repository's sites from this deployment and its file, before the
 * run, so a new site is checked at once. A successful deployment of an
 * environment the file's `deployments.environments` allows (every one that is
 * not a preview, without it) names its site with its address; one that names
 * none cannot be told apart from any other, so it adds nothing and is noted for
 * the repository page, unless the file declares the sites itself. The sites
 * the file declares are kept current here too; a file that could not be read
 * changes none.
 */
async function settleSites(
  db: Database,
  userId: number,
  deployed: Readonly<Deployment>,
  rules: DeploymentRules,
): Promise<void> {
  // A push of the file (`force`, no environment) is no deployment: it only
  // refreshes the sites the file declares.
  const isDeployment = deployed.name !== '';
  const named =
    isDeployment &&
    (rules.siteEnvironments === null ||
      matchesAny(rules.siteEnvironments, deployed.name));
  const address = named && deployed.url ? siteAddress(deployed.url) : null;
  if (isDeployment) {
    if (!named || address?.ok || (rules.read && rules.sites.length > 0)) {
      await clearGap(db, deployed.repo, deployed.name);
    } else {
      await noteGap(db, deployed.repo, deployed.name);
    }
  }
  await reconcileSites(db, userId, deployed.repo, {
    declared: rules.read ? rules.sites : null,
    ...(address?.ok
      ? { deployed: { environment: deployed.name, host: address.host } }
      : {}),
  });
}

/**
 * The latest run of the live site a preview is a copy of, or null when there is
 * none to compare with (see `baseline.ts` for how the site is found).
 */
async function baselineOf(
  db: Database,
  userId: number,
  deployed: Readonly<Deployment>,
  rules: DeploymentRules,
): Promise<{ host: string; findings: readonly StoredFinding[] } | null> {
  const host = baselineHost({
    environment: deployed.name,
    sites: await listDomainsOfRepo(db, userId, deployed.repo),
    mapping: rules.previews,
  });
  if (host === null) {
    return null;
  }
  const [run] = await latestRuns(db, userId, host, 1);
  return run ? { host, findings: run.findings } : null;
}

/**
 * Applies the `enabled` flag of the repository's file to a live deployment or a
 * push of the file. Returns true when checks are off and the run must stop.
 * `enabled: false` is remembered (the repository's issues are closed once, with
 * a note); a file that no longer says it forgets it, and the run goes on. When
 * the file could not be read nothing changes: an unreadable file must not
 * resume checks the file turned off.
 */
async function applyEnabledFlag(
  db: Database,
  api: GitHubApi | null,
  deployed: Readonly<Deployment>,
  rules: DeploymentRules,
  fileOff: boolean,
  deps: RunDeps,
): Promise<boolean> {
  if (!rules.read) {
    return fileOff;
  }
  if (!rules.enabled) {
    const added = await disableRepoByFile(db, deployed.repo);
    if (added) {
      await stopChecking(db, deployed.repo);
      if (api) {
        try {
          await closeUndeployed(api, db, {
            repo: deployed.repo,
            hosts: new Set(),
            sha: deployed.sha,
            source: rules.source,
            pause: deps.pause ?? pauseBetweenWrites,
            reason: 'config',
          });
        } catch (error) {
          console.error(
            'closing issues of a disabled repository failed',
            error,
          );
        }
      }
    }
    return true;
  }
  if (fileOff) {
    await enableRepoByFile(db, deployed.repo);
  }
  return false;
}

/**
 * Checks the registered sites of the repository and reports each problem on
 * its own issue. The issues of checks the rules no longer ask for, and of sites
 * the repository no longer deploys, are closed.
 */
async function checkLive(
  db: Database,
  api: GitHubApi | null,
  userId: number,
  deployed: Readonly<Deployment>,
  rules: ResolvedRules,
  deps: RunDeps,
): Promise<void> {
  const outcomes = await checkDeployment(db, userId, deployed, {
    ...deps,
    levels: rules.levels,
  });
  const origin = api ? originOf(api, deployed.repo, deployed.sha) : undefined;
  // One budget for the whole repository, so a monorepo's first run is as calm
  // as a single site's.
  const budget = newBudget();
  const pause = deps.pause ?? pauseBetweenWrites;
  for (const outcome of outcomes) {
    // Nothing to say about a site that was not looked at. A site that looks as
    // it did is still synced, because an issue may not match what it found
    // (the last update failed, or a person deleted it).
    if (!api || outcome.skipped || !outcome.url) {
      continue;
    }
    try {
      await syncIssues(api, db, {
        repo: deployed.repo,
        host: outcome.host,
        sha: deployed.sha,
        url: outcome.url,
        findings: outcome.findings ?? [],
        notRun: outcome.notRun ?? [],
        levels: rules.levels,
        origin,
        budget,
        pause,
        ...(deps.appUrl
          ? { pageUrl: `${deps.appUrl}/repos/${deployed.repo}` }
          : {}),
        level: rules.issues,
        source: rules.source,
        problems: rules.problems,
      });
    } catch (error) {
      console.error('issue sync failed', deployed.repo, outcome.host, error);
    }
    if (rules.dispatch) {
      await dispatchRun(api, {
        repo: deployed.repo,
        environment: 'production',
        url: outcome.url,
        sha: deployed.sha,
        findings: outcome.findings ?? [],
      });
    }
  }
  if (!api) {
    return;
  }
  try {
    await noteDeferred(api, deployed.repo, budget);
    // The sites the repository still deploys; the issues of any other are closed.
    const hosts = new Set(
      (await listDomainsOfRepo(db, userId, deployed.repo)).map(
        (site) => site.host,
      ),
    );
    await closeUndeployed(api, db, {
      repo: deployed.repo,
      hosts,
      sha: deployed.sha,
      source: rules.source,
      pause,
    });
  } catch (error) {
    console.error('issue cleanup failed', deployed.repo, error);
  }
}

/**
 * Keeps what a preview's check found under a random id, and says where to read
 * it. Nothing is kept, and the check links to the preview itself, when the
 * app's origin is not known or the report cannot be stored.
 */
async function keepReport(
  db: Database,
  appUrl: string | undefined,
  report: Parameters<typeof savePreviewReport>[1],
): Promise<{ reportId?: string; reportUrl?: string; dataUrl?: string }> {
  if (!appUrl) {
    return {};
  }
  try {
    const id = await savePreviewReport(db, report);
    return {
      reportId: id,
      reportUrl: `${appUrl}/r/${id}`,
      dataUrl: `${appUrl}/api/previews/${id}`,
    };
  } catch (error) {
    console.error('report not kept', report.repo, error);
    return {};
  }
}

/**
 * Checks the preview at the address the deployment names and reports it on the
 * commit. The check fails only for problems the change brought: the findings
 * are compared with the latest run of the live site the preview is a copy of.
 * Without such a site to compare with, any error fails it.
 */
async function checkPreview(
  db: Database,
  api: GitHubApi | null,
  userId: number,
  deployed: Readonly<Deployment>,
  rules: DeploymentRules,
  deps: RunDeps,
): Promise<void> {
  const { url, sha } = deployed;
  if (!api || !url || !sha || !parseHost(url).ok) {
    return;
  }
  // A report is kept by commit: the same commit of the same preview is checked
  // once, however often its deployment is reported (unless the rules changed).
  if (!deps.force && (await reportOfCommit(db, deployed.repo, sha, url))) {
    return;
  }
  let checks;
  try {
    if (!deps.run) {
      throw new Error('No scanner is available.');
    }
    checks = (await deps.run(url)).checks;
  } catch (error) {
    console.error('preview run failed', deployed.repo, url, error);
    await publishUnreachable(api, deployed.repo, sha, url).catch(
      (failure: unknown) => console.error('check run failed', failure),
    );
    return;
  }
  const findings = findingsOf(applyLevels(checks, rules.levels));
  let comparison: Comparison | undefined;
  try {
    const baseline = await baselineOf(db, userId, deployed, rules);
    comparison = baseline
      ? compareWithBaseline(
          findings,
          { ...baseline, levels: rules.liveChecks },
          new Set(rules.levels.keys()),
        )
      : undefined;
  } catch (error) {
    // Without a baseline the preview is judged on its own, as it was before.
    console.error('baseline not read', deployed.repo, error);
  }
  const stored = await keepReport(db, deps.appUrl, {
    repo: deployed.repo,
    sha,
    url,
    findings,
  });
  try {
    await publishCheckRun(api, {
      repo: deployed.repo,
      sha,
      url,
      findings,
      ...(comparison ? { comparison } : {}),
      ...stored,
      source: rules.source,
      problems: rules.problems,
    });
  } catch (error) {
    console.error('check run failed', deployed.repo, error);
  }
  if (rules.dispatch) {
    await dispatchRun(api, {
      repo: deployed.repo,
      environment: 'preview',
      url,
      sha,
      findings,
    });
  }
}

/**
 * Handles one successful deployment of an installation's repository. A live
 * site is checked under the production rules, a preview under the preview
 * rules.
 */
export async function handleDeployment(
  db: Database,
  config: GitHubConfig,
  installationId: number,
  userId: number,
  deployed: Readonly<Deployment>,
  deps: RunDeps = {},
): Promise<void> {
  // A preview with no address or commit has nothing to check or to report on.
  if (deployed.environment === 'preview' && (!deployed.url || !deployed.sha)) {
    return;
  }
  // Checks were turned off after this job was queued.
  if (await isRepoSwitchedOff(db, deployed.repo)) {
    return;
  }
  // A repository whose file turns checks off is read only to see whether the
  // flag changed, which is what a push of the file (`force`) is for.
  const fileOff = await isRepoFileDisabled(db, deployed.repo);
  if (fileOff && !deps.force) {
    return;
  }
  const fetcher = deps.fetcher ?? fetch;
  let api: GitHubApi | null = null;
  try {
    api = new GitHubApi(
      await installationToken(config, installationId, fetcher),
      fetcher,
    );
  } catch (error) {
    console.error('github token failed', installationId, error);
  }
  const rules = await rulesFor(api, deployed);
  if (deployed.environment === 'production') {
    if (await applyEnabledFlag(db, api, deployed, rules, fileOff, deps)) {
      return;
    }
    try {
      await settleSites(db, userId, deployed, rules);
    } catch (error) {
      console.error('settling the sites failed', deployed.repo, error);
    }
    await checkLive(db, api, userId, deployed, rules, deps);
  } else if (rules.read && !rules.enabled) {
    // A branch whose file turns checks off is not checked; nothing is remembered.
    return;
  } else {
    await checkPreview(db, api, userId, deployed, rules, deps);
  }
}
