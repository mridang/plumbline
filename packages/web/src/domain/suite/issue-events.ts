/**
 * @packageDocumentation
 *
 * What people do to the issues the app opened. The app tracks the issue of each
 * check, so it can reopen one it closed when the problem comes back, and it
 * reopens one a person closes while the problem is still there, with a note
 * that says how to turn the check off instead. After {@link MAX_REOPENS}
 * reopenings it leaves the issue closed, so the app never fights a person.
 * GitHub tells it when an issue is closed, reopened or deleted; what the app
 * did itself comes back as an event from its own account and is ignored.
 */

import type { Database } from '@/domain/db/client';
import { isRepoDisabled } from '@/domain/db/disabled';
import { forgetIssue, issueNumbered, saveIssue } from '@/domain/db/suite';
import type { GitHubApi } from '@/domain/github/api';
import type { Delivery } from '@/domain/github/deployments';
import { reopenIssue } from '@/domain/suite/publish';

/** The name GitHub gives a GitHub App's account, as the sender of what it did. */
export function botLogin(slug: string): string {
  return `${slug}[bot]`;
}

/**
 * Whether the app opened an issue of the delivery's repository, and what
 * became of it. `makeApi` is only called when the app has to answer on GitHub.
 */
export async function handleIssueEvent(
  db: Database,
  slug: string,
  delivery: Readonly<Delivery>,
  makeApi: () => Promise<GitHubApi>,
): Promise<void> {
  const repo = delivery.repository?.full_name;
  const number = delivery.issue?.number;
  if (!repo || number === undefined) {
    return;
  }
  // A repository whose checks are off has no issues to look after.
  if (await isRepoDisabled(db, repo)) {
    return;
  }
  const stored = await issueNumbered(db, repo, number);
  if (!stored) {
    return;
  }
  if (delivery.action === 'deleted') {
    await forgetIssue(db, repo, number);
    return;
  }
  if (delivery.sender?.login === botLogin(slug)) {
    return;
  }
  const { host, check, ...issue } = stored;
  if (delivery.action === 'closed' && stored.state === 'open') {
    // The issue was open, so the check still failed at the last run.
    await reopenIssue(await makeApi(), db, { repo, host, check, issue });
  } else if (delivery.action === 'reopened' && stored.state !== 'open') {
    await saveIssue(db, repo, host, check, { ...issue, state: 'open' });
  }
}
