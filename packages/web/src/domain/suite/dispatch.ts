/**
 * @packageDocumentation
 *
 * Lets a repository hook into what the app finds. When `plumbline.yaml` says
 * `dispatch: true`, each run of a site or preview sends a GitHub
 * `repository_dispatch` event that the repository's own workflows can listen
 * for (`on: repository_dispatch: types: [plumbline.checked]`):
 *
 * - `plumbline.checked` after every run, and
 * - `plumbline.failed` as well when the run found errors.
 *
 * The payload is small and fixed (GitHub allows ten top-level properties and
 * 65,535 characters): the environment, address, host, commit, conclusion, the
 * counts, and the first few findings. Sending is best effort: a repository
 * that has not given the app write access to its contents just does not get
 * the event, and that is logged, never raised.
 */

import { GitHubApi, GitHubError } from '@/domain/github/api';
import type { Environment } from '@/domain/suite/config';
import type { StoredFinding } from '@/domain/suite/diff';
import { conclusionOf, countsOf, safeText } from '@/domain/suite/report';

/** The most findings carried in an event. */
export const MAX_DISPATCHED = 10;

/** The event sent after every run. */
export const CHECKED_EVENT = 'plumbline.checked';

/** The event sent as well when a run found errors. */
export const FAILED_EVENT = 'plumbline.failed';

/** What a run reports to the repository's workflows. */
export interface DispatchRun {
  readonly repo: string;
  readonly environment: Environment;
  readonly url: string;
  readonly sha: string | null;
  readonly findings: readonly StoredFinding[];
}

/** The `client_payload` of an event: at most ten properties, all plain data. */
export function payloadOf(run: Readonly<DispatchRun>): Record<string, unknown> {
  const { errors, warnings, hints } = countsOf(run.findings);
  return {
    version: 1,
    environment: run.environment,
    url: run.url,
    host: new URL(run.url).host,
    sha: run.sha,
    conclusion: conclusionOf(run.findings),
    errors,
    warnings,
    hints,
    findings: run.findings.slice(0, MAX_DISPATCHED).map((found) => ({
      id: found.id,
      severity: found.severity,
      message: safeText(found.message),
    })),
  };
}

/** The events to send for a run, in order. */
export function eventsFor(run: Readonly<DispatchRun>): string[] {
  return countsOf(run.findings).errors > 0
    ? [CHECKED_EVENT, FAILED_EVENT]
    : [CHECKED_EVENT];
}

/** Sends the events of a run; a failure is logged and goes no further. */
export async function dispatchRun(
  api: GitHubApi,
  run: Readonly<DispatchRun>,
): Promise<void> {
  const payload = payloadOf(run);
  for (const event of eventsFor(run)) {
    try {
      await api.dispatchEvent(run.repo, event, payload);
    } catch (error) {
      const hint =
        error instanceof GitHubError &&
        (error.status === 403 || error.status === 404)
          ? ' (the app needs the Contents permission set to read and write)'
          : '';
      console.error(`dispatch failed for ${run.repo}${hint}`, event, error);
      return;
    }
  }
}
