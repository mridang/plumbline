/**
 * @packageDocumentation
 *
 * Reading an installation: list its repositories, find out which are deployed
 * web applications and where, remember them, and add the hosts as domains the
 * person's checks run against. Runs when the person connects, when GitHub says
 * the installation changed, and when they ask for a refresh.
 */

import type { Database } from '@/domain/db/client';
import { addDomain, countDomains, MAX_DOMAINS } from '@/domain/db/domains';
import { saveRepos, type AnalysedRepo } from '@/domain/db/github';

import { GitHubApi, type Repo } from './api';
import { deploymentHosts } from './deployments';

/** How many repositories are read at once, to stay inside a request's limits. */
const CONCURRENCY = 10;

/** The most repositories read per installation in one sync. */
export const MAX_REPOS = 300;

/** What a sync found. */
export interface SyncResult {
  /** Repositories read. */
  readonly repositories: number;
  /** Repositories that are deployed web applications. */
  readonly deployed: number;
  /** Domains newly added for the person. */
  readonly domainsAdded: number;
}

/** Read one repository: where it is deployed, or nowhere. */
export async function analyseRepo(
  api: GitHubApi,
  repo: Readonly<Repo>,
): Promise<AnalysedRepo> {
  let hosts: string[] = [];
  try {
    const paths = await api.filePaths(repo.full_name, repo.default_branch);
    hosts = await deploymentHosts({
      paths,
      read: (path) => api.file(repo.full_name, path, repo.default_branch),
      homepage: repo.homepage,
    });
  } catch {
    // An empty or unreadable repository is simply not a deployed application.
  }
  return {
    full_name: repo.full_name,
    default_branch: repo.default_branch,
    hosts,
  };
}

/** Run `work` over `items` a few at a time, keeping the order of the results. */
async function inBatches<T, R>(
  items: readonly T[],
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let at = 0; at < items.length; at += CONCURRENCY) {
    out.push(
      ...(await Promise.all(items.slice(at, at + CONCURRENCY).map(work))),
    );
  }
  return out;
}

/**
 * Read an installation's repositories (archived ones are skipped) with an
 * installation token, store what was found, and add each deployed host as a
 * domain of the owner, up to the number of domains a person may keep.
 */
export async function syncInstallation(
  db: Database,
  userId: number,
  installationId: number,
  api: GitHubApi,
): Promise<SyncResult> {
  const repos = (await api.repositories())
    .filter((repo) => !repo.archived)
    .slice(0, MAX_REPOS);
  const analysed = await inBatches(repos, (repo) => analyseRepo(api, repo));
  await saveRepos(db, userId, installationId, analysed);

  let room = MAX_DOMAINS - (await countDomains(db, userId));
  let domainsAdded = 0;
  for (const repo of analysed) {
    for (const host of repo.hosts) {
      if (room <= 0) {
        break;
      }
      const { created } = await addDomain(db, userId, host, repo.full_name);
      if (created) {
        domainsAdded += 1;
        room -= 1;
      }
    }
  }
  return {
    repositories: analysed.length,
    deployed: analysed.filter((repo) => repo.hosts.length > 0).length,
    domainsAdded,
  };
}
