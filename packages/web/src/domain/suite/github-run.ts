/**
 * @packageDocumentation
 *
 * What a successful deployment on GitHub starts. The repository's
 * `plumbline.yaml` is read at the deployed commit to find the rules. A live
 * site is checked as its registered domains and its findings go to the issue
 * that tracks the site; a preview is checked at the address the deployment
 * names and the findings go to a check run on the commit, which GitHub shows
 * on the pull request. Nothing here may fail the delivery: a problem reaching
 * GitHub is logged and the run goes on with the default rules.
 */

import { parseHost } from '@/domain/api/domain-resource';
import type { Database } from '@/domain/db/client';
import { GitHubApi, GitHubError, TooLargeError } from '@/domain/github/api';
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
  originOf,
  publishCheckRun,
  publishUnreachable,
  syncIssue,
} from '@/domain/suite/publish';
import { dispatchRun } from '@/domain/suite/dispatch';
import { runSuite } from '@/domain/suite/run';
import { applyLevels } from '@/domain/suite/rules';

/** What the work can be given in place of the real thing, for tests. */
export interface RunDeps extends Deps {
  readonly fetcher?: typeof fetch;
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

/** Checks the registered sites of the repository and reports each on its issue. */
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
  for (const outcome of outcomes) {
    // Nothing to say about a site that was not looked at. A site that looks as
    // it did is still synced, because the issue may not match what it found
    // (the last update failed, or a person deleted it).
    if (!api || outcome.skipped || !outcome.url) {
      continue;
    }
    try {
      await syncIssue(api, db, {
        repo: deployed.repo,
        host: outcome.host,
        sha: deployed.sha,
        url: outcome.url,
        findings: outcome.findings ?? [],
        unchanged: outcome.unchanged ?? false,
        origin,
        level: rules.issues,
        source: rules.source,
        browserOnly: rules.browserOnly,
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
}

/** Checks the preview at the address the deployment names and reports it on the commit. */
async function checkPreview(
  api: GitHubApi | null,
  deployed: Readonly<Deployment>,
  rules: ResolvedRules,
  deps: RunDeps,
): Promise<void> {
  const { url, sha } = deployed;
  if (!api || !url || !sha || !parseHost(url).ok) {
    return;
  }
  const run = deps.run ?? ((address, hash) => runSuite(address, hash));
  let checks;
  try {
    checks = (await run(url, null)).checks ?? [];
  } catch (error) {
    console.error('preview run failed', deployed.repo, url, error);
    await publishUnreachable(api, deployed.repo, sha, url).catch(
      (failure: unknown) => console.error('check run failed', failure),
    );
    return;
  }
  const findings = findingsOf(applyLevels(checks, rules.levels));
  try {
    await publishCheckRun(api, {
      repo: deployed.repo,
      sha,
      url,
      findings,
      source: rules.source,
      browserOnly: rules.browserOnly,
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
    await checkPreview(api, deployed, rules, deps);
  }
}
