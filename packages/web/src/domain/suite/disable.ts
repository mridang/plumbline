/**
 * @packageDocumentation
 *
 * Turning off the checks of a repository. The flag is stored first, so
 * webhooks that arrive meanwhile are discarded; then the repository's open
 * issues are closed with an explanation, using the app's installation. Nothing
 * here opens an issue, a check run or a notification.
 */

import type { Database } from '@/domain/db/client';
import { disableRepo, stopChecking } from '@/domain/db/disabled';
import { installationOfRepo } from '@/domain/db/github';
import { GitHubApi } from '@/domain/github/api';
import { installationToken } from '@/domain/github/app-auth';
import type { GitHubConfig } from '@/domain/github/config';
import { githubConfig } from '@/domain/github/service';
import { closeUndeployed, pauseBetweenWrites } from '@/domain/suite/publish';
import { runInBackground } from '@/lib/core/runtime';

/** What turning checks off can be given in place of the real thing, for tests. */
export interface PauseDeps {
  /** The app's settings; the environment's when left out. */
  readonly config?: GitHubConfig | null;
  readonly fetcher?: typeof fetch;
  /** Runs the closing of the issues; in the background of the request when left out. */
  readonly background?: (work: Promise<unknown>) => void;
  /** The pause between two writes to GitHub. */
  readonly pause?: () => Promise<void>;
  readonly now?: () => Date;
}

/** Close every open issue of the repository, saying why. A failure is logged, never raised. */
export async function closeIssuesOfDisabled(
  db: Database,
  repo: string,
  deps: PauseDeps = {},
): Promise<void> {
  try {
    const config = deps.config === undefined ? githubConfig() : deps.config;
    const installation = await installationOfRepo(db, repo);
    if (!config || installation === undefined) {
      return;
    }
    const fetcher = deps.fetcher ?? fetch;
    const api = new GitHubApi(
      await installationToken(config, installation, fetcher),
      fetcher,
    );
    await closeUndeployed(api, db, {
      repo,
      hosts: new Set(),
      sha: null,
      source: null,
      pause: deps.pause ?? pauseBetweenWrites,
      reason: 'disabled',
    });
  } catch (error) {
    console.error(
      'closing issues of a disabled repository failed',
      repo,
      error,
    );
  }
}

/**
 * Turns off the checks of the repository: stores the flag, stops its sites
 * showing as checking, and closes its open issues (in the background, since
 * each close is a write to GitHub). Already off: nothing more happens.
 */
export async function pauseRepo(
  db: Database,
  userId: number,
  repo: string,
  deps: PauseDeps = {},
): Promise<void> {
  const now = deps.now ?? (() => new Date());
  const changed = await disableRepo(db, userId, repo, now().toISOString());
  await stopChecking(db, repo);
  if (changed) {
    (deps.background ?? runInBackground)(closeIssuesOfDisabled(db, repo, deps));
  }
}
