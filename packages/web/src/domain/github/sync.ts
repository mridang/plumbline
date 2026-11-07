/**
 * @packageDocumentation
 *
 * Reading an installation: list its repositories, find out which are deployed
 * web applications and where, remember them, and add the hosts as domains the
 * person's checks run against. Runs when the person connects, when GitHub says
 * the installation changed, and when they ask for a refresh.
 */

import type { Database } from '@/domain/db/client';
import {
  listDomainsOfRepo,
  removeSitesOfMissingRepos,
} from '@/domain/db/domains';
import { listRepos, saveRepos, type AnalysedRepo } from '@/domain/db/github';
import { loadConfig } from '@/domain/suite/github-run';

import { GitHubApi, type Repo } from './api';
import { deploymentHosts } from './deployments';
import { isReal, reconcileSites } from './sites';

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

/** What reading one repository found. */
export interface Analysis extends AnalysedRepo {
  /**
   * The hosts the Wrangler routes and the Website field suggest; null when the
   * repository could not be read, so a GitHub hiccup cannot drop its sites.
   */
  readonly fallback: readonly string[] | null;
  /**
   * The hosts the repository's `plumbline.yaml` declares as sites; null when
   * the file could not be read (or the repository is a fork, whose file is the
   * upstream project's).
   */
  readonly declared: readonly string[] | null;
}

/**
 * Read one repository: the sites its file declares and the ones its Wrangler
 * routes and Website field suggest. `hosts` is the fallback until the sites are
 * settled by {@link syncInstallation}.
 */
export async function analyseRepo(
  api: GitHubApi,
  repo: Readonly<Repo>,
): Promise<Analysis> {
  let fallback: string[] | null = null;
  let declared: readonly string[] | null = null;
  try {
    const paths = await api.filePaths(repo.full_name, repo.default_branch);
    fallback = await deploymentHosts({
      paths,
      read: (path) => api.file(repo.full_name, path, repo.default_branch),
      // A fork carries the upstream project's website, which is not this account's site.
      homepage: repo.fork ? null : repo.homepage,
    });
    if (!repo.fork) {
      const { loaded, unreadable } = await loadConfig(
        api,
        repo.full_name,
        repo.default_branch,
      );
      declared = unreadable === null ? (loaded?.sites ?? []) : null;
    }
  } catch {
    // A repository that cannot be read right now says nothing about its sites.
  }
  return {
    full_name: repo.full_name,
    default_branch: repo.default_branch,
    hosts: fallback ?? [],
    fallback,
    declared,
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
 * installation token, store what was found, and settle each repository's
 * sites as domains of the owner (see `sites.ts`), up to the number of domains a
 * person may keep.
 */
export async function syncInstallation(
  db: Database,
  userId: number,
  installationId: number,
  api: GitHubApi,
): Promise<SyncResult> {
  const listed = await api.repositories();
  const repos = listed.filter((repo) => !repo.archived).slice(0, MAX_REPOS);
  const analysed = await inBatches(repos, (repo) => analyseRepo(api, repo));
  // Settle each repository's sites from what its file and routes say, and what
  // its deployments have already reported (those are in the database).
  let domainsAdded = 0;
  const settled: AnalysedRepo[] = [];
  for (const repo of analysed) {
    const changes = await reconcileSites(db, userId, repo.full_name, {
      declared: repo.declared,
      fallback: repo.fallback,
    });
    domainsAdded += changes.added.length;
    const sites = await listDomainsOfRepo(db, userId, repo.full_name);
    const declared = repo.declared ?? [];
    const real = declared.length > 0 || sites.some(isReal);
    // What the repository is deployed on, even where the limit on a person's
    // domains kept a site off the dashboard.
    settled.push({
      full_name: repo.full_name,
      default_branch: repo.default_branch,
      hosts: [
        ...new Set([
          ...sites.map((site) => site.host),
          ...declared,
          ...(real ? [] : (repo.fallback ?? [])),
        ]),
      ],
    });
  }
  await saveRepos(db, userId, installationId, settled);
  // A repository that was deleted, or taken out of the app, takes its sites
  // off the dashboard. An archived one still exists, so its sites stay, and a
  // listing cut short by the limit proves nothing about the rest.
  if (listed.length < MAX_REPOS) {
    await removeSitesOfMissingRepos(
      db,
      userId,
      new Set([
        ...listed.map((repo) => repo.full_name),
        ...(await listRepos(db, userId)).map((repo) => repo.full_name),
      ]),
    );
  }
  return {
    repositories: analysed.length,
    deployed: settled.filter((repo) => repo.hosts.length > 0).length,
    domainsAdded,
  };
}
