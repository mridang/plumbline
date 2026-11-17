/**
 * @packageDocumentation
 *
 * Reading an installation: list its repositories, find out which are deployed
 * web applications and where, remember them, and add the hosts as domains the
 * person's checks run against. Runs when the person connects, when GitHub says
 * the installation changed, and when they ask for a refresh.
 */

import {
  listDomainsOfRepo,
  removeSitesOfMissingRepos,
} from '@/domain/db/domains';
import { listRepos, saveRepos } from '@/domain/db/github';
import { loadConfig } from '@/domain/suite/github-run';

import { deploymentHosts } from './deployments';
import { isReal, reconcileSites } from './sites';
import type { AnalysedRepo } from '@/domain/db/github';
import type { GitHubApi, Repo } from './api';
import type { Database } from '@/domain/db/client';

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
  // A repository that cannot be read right now says nothing about its sites.
  const paths = await api
    .filePaths(repo.full_name, repo.default_branch)
    .catch(() => null);
  const fallback =
    paths === null
      ? null
      : await deploymentHosts({
          paths,
          read: async (path) =>
            api.file(repo.full_name, path, repo.default_branch),
          // A fork carries the upstream project's website, which is not this account's site.
          homepage: repo.fork ? null : repo.homepage,
        }).catch(() => null);
  const declared =
    fallback === null || repo.fork
      ? null
      : await loadConfig(api, repo.full_name, repo.default_branch)
          .then(({ loaded, unreadable }) =>
            unreadable === null ? (loaded?.sites ?? []) : null,
          )
          .catch(() => null);
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
  const groups = Array.from(
    { length: Math.ceil(items.length / CONCURRENCY) },
    (_, group) => items.slice(group * CONCURRENCY, (group + 1) * CONCURRENCY),
  );
  return groups.reduce(
    async (previous, group) => [
      ...(await previous),
      ...(await Promise.all(group.map(async (item) => work(item)))),
    ],
    Promise.resolve<R[]>([]),
  );
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
  const analysed = await inBatches(repos, async (repo) =>
    analyseRepo(api, repo),
  );
  // Settle each repository's sites from what its file and routes say, and what
  // its deployments have already reported (those are in the database).
  const { domainsAdded, settled } = await analysed.reduce(
    async (previous, repo) => {
      const state = await previous;
      const changes = await reconcileSites(db, userId, repo.full_name, {
        declared: repo.declared,
        fallback: repo.fallback,
      });
      const sites = await listDomainsOfRepo(db, userId, repo.full_name);
      const declared = repo.declared ?? [];
      const real = declared.length > 0 || sites.some((site) => isReal(site));
      // What the repository is deployed on, even where the limit on a person's
      // domains kept a site off the dashboard.
      const deployedOn = new Set(sites.map((site) => site.host))
        .union(new Set(declared))
        .union(new Set(real ? [] : repo.fallback));
      return {
        domainsAdded: state.domainsAdded + changes.added.length,
        settled: [
          ...state.settled,
          {
            full_name: repo.full_name,
            default_branch: repo.default_branch,
            hosts: [...deployedOn],
          },
        ],
      };
    },
    Promise.resolve({ domainsAdded: 0, settled: [] as AnalysedRepo[] }),
  );
  await saveRepos(db, userId, installationId, settled);
  // A repository that was deleted, or taken out of the app, takes its sites
  // off the dashboard. An archived one still exists, so its sites stay, and a
  // listing cut short by the limit proves nothing about the rest.
  if (listed.length < MAX_REPOS) {
    const stored = await listRepos(db, userId);
    const names = new Set(listed.map((repo) => repo.full_name)).union(
      new Set(stored.map((repo) => repo.full_name)),
    );
    await removeSitesOfMissingRepos(db, userId, names);
  }
  return {
    repositories: analysed.length,
    deployed: settled.filter((repo) => repo.hosts.length > 0).length,
    domainsAdded,
  };
}
