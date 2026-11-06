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

import { isRepoDisabled } from '@/domain/db/disabled';
import { parseHost } from '@/domain/api/domain-resource';
import type { Database } from '@/domain/db/client';
import { listDomainsOfRepo } from '@/domain/db/domains';
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
import { findingsOf } from '@/domain/suite/diff';
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

/** The rules for a deployment: those in the repository's file at that commit, or the defaults. */
async function rulesFor(
  api: GitHubApi | null,
  deployed: Readonly<Deployment>,
): Promise<ResolvedRules> {
  if (!api || !deployed.sha) {
    return resolveRules(null, deployed.environment);
  }
  const { loaded, unreadable } = await loadConfig(
    api,
    deployed.repo,
    deployed.sha,
  );
  const rules = resolveRules(loaded, deployed.environment);
  return unreadable
    ? { ...rules, problems: [...rules.problems, unreadable] }
    : rules;
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

/** Checks the preview at the address the deployment names and reports it on the commit. */
async function checkPreview(
  db: Database,
  api: GitHubApi | null,
  deployed: Readonly<Deployment>,
  rules: ResolvedRules,
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
  if (await isRepoDisabled(db, deployed.repo)) {
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
    await checkLive(db, api, userId, deployed, rules, deps);
  } else {
    await checkPreview(db, api, deployed, rules, deps);
  }
}
