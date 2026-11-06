/**
 * @packageDocumentation
 *
 * What the GitHub routes share: the app's settings from the environment, the
 * cookie that holds the one-time state of a round trip to GitHub, and syncing
 * an installation as the app.
 */

import type { Database } from '@/domain/db/client';
import { listInstallations, touchInstallation } from '@/domain/db/github';
import { getEnv } from '@/lib/core/runtime';

import { GitHubApi } from './api';
import { installationToken } from './app-auth';
import { readGitHubConfig, type GitHubConfig } from './config';
import { syncInstallation, type SyncResult } from './sync';

/** The short-lived cookie holding the one-time `state` of a round trip to GitHub. */
export const GITHUB_STATE_COOKIE = 'plumbline_github_state';

/** Where people land after connecting, or with a reason connecting failed. */
export const GITHUB_PATH = '/github';

/** The app's settings, or null when GitHub integration is not set up here. */
export function githubConfig(): GitHubConfig | null {
  return readGitHubConfig(getEnv());
}

/** Read one installation as the app and store what was found. */
export async function syncAsApp(
  db: Database,
  config: GitHubConfig,
  userId: number,
  installationId: number,
  fetcher: typeof fetch = fetch,
): Promise<SyncResult> {
  const token = await installationToken(config, installationId, fetcher);
  const result = await syncInstallation(
    db,
    userId,
    installationId,
    new GitHubApi(token, fetcher),
  );
  await touchInstallation(db, installationId);
  return result;
}

/** What reading every installation found, and why any of them could not be read. */
export interface SyncAllResult extends SyncResult {
  /** One line per installation that failed, for showing to the person. */
  readonly failures: readonly string[];
}

/** Read every installation the person owns. A failing one is skipped, not fatal. */
export async function syncAllOf(
  db: Database,
  config: GitHubConfig,
  userId: number,
  fetcher: typeof fetch = fetch,
): Promise<SyncAllResult> {
  const total = { repositories: 0, deployed: 0, domainsAdded: 0 };
  const failures: string[] = [];
  for (const installation of await listInstallations(db, userId)) {
    try {
      const result = await syncAsApp(
        db,
        config,
        userId,
        installation.installation_id,
        fetcher,
      );
      total.repositories += result.repositories;
      total.deployed += result.deployed;
      total.domainsAdded += result.domainsAdded;
    } catch (error) {
      console.error('github sync failed', installation.installation_id, error);
      failures.push(
        `${installation.account_login}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
  return { ...total, failures };
}
