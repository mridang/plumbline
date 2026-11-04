/**
 * @packageDocumentation
 *
 * What people do to the issues the app opened. The app tracks each issue's
 * state, so it can reopen one it closed when the problems come back and leave
 * alone one a person closed with the problems still there. GitHub tells it
 * when an issue is closed, reopened or deleted; what the app did itself comes
 * back as an event from its own account and is ignored.
 */

import type { Database } from '@/domain/db/client';
import { forgetIssue, issueNumbered, saveIssue } from '@/domain/db/suite';
import type { Delivery } from '@/domain/github/deployments';

/** The name GitHub gives a GitHub App's account, as the sender of what it did. */
export function botLogin(slug: string): string {
  return `${slug}[bot]`;
}

/** Whether the app opened an issue of the delivery's repository, and what became of it. */
export async function handleIssueEvent(
  db: Database,
  slug: string,
  delivery: Readonly<Delivery>,
): Promise<void> {
  const repo = delivery.repository?.full_name;
  const number = delivery.issue?.number;
  if (!repo || number === undefined) {
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
  const { host, ...issue } = stored;
  if (delivery.action === 'closed' && stored.state === 'open') {
    await saveIssue(db, repo, host, { ...issue, state: 'dismissed' });
  } else if (delivery.action === 'reopened' && stored.state !== 'open') {
    await saveIssue(db, repo, host, { ...issue, state: 'open' });
  }
}
