/**
 * GitHub's deliveries for the app. Every one is checked against the shared
 * secret before anything is read. An installation that was removed is
 * forgotten; a change to an installation's repositories or permissions, or a
 * push to a Wrangler configuration, reads the installation again so the
 * deployed hosts stay right. A push of `plumbline.yaml` to the default branch
 * checks the live site again under the new rules, and an issue a person
 * closes, reopens or deletes is noted so the app treats it accordingly (one
 * closed while its problem is still there is reopened, with a note). A
 * successful deployment runs every check in the scanner container, once per
 * delivery (GitHub retries are recognised by their id): on the repository's
 * sites when it is the live site, and on the deployment's own address when it
 * is a preview. A scan takes longer than a delivery may keep working, so the
 * delivery only leaves a job with the scan queue, which runs it in a scanner
 * container of its own, many at once. A repository whose checks a person turned off gets none of this: its
 * deliveries are acknowledged and dropped. Anything else is acknowledged and ignored.
 */

import { NextResponse } from 'next/server';

import { getDatabase } from '@/domain/db/client';
import { isRepoDisabled, isRepoSwitchedOff } from '@/domain/db/disabled';
import { ownerOfInstallation, removeInstallation } from '@/domain/db/github';
import { claimDelivery } from '@/domain/db/suite';
import {
  isDefaultBranchPush,
  touchesConfig,
  touchesWrangler,
  type Delivery,
} from '@/domain/github/deployments';
import { installationToken } from '@/domain/github/app-auth';
import { GitHubApi } from '@/domain/github/api';
import { githubConfig, syncAsApp } from '@/domain/github/service';
import { verifySignature } from '@/domain/github/webhook';
import { classifyDeployment } from '@/domain/suite/deploy';
import { handleIssueEvent } from '@/domain/suite/issue-events';
import { enqueueScan } from '@/domain/suite/queue';
import type { SuiteJob } from '@/domain/suite/scanner';
import { appOrigin } from '@/lib/core/origin';
import { getEnv, runInBackground } from '@/lib/core/runtime';

/**
 * Whether a delivery means the installation's repositories or what the app may
 * do changed, so the hosts it serves must be read again: repositories added or
 * removed, permissions accepted, a suspension lifted, a Wrangler file pushed.
 */
function rereadsInstallation(
  event: string | null,
  delivery: Readonly<Delivery>,
): boolean {
  if (event === 'installation_repositories') {
    return true;
  }
  // A repository that was deleted, archived, renamed or moved to another owner.
  if (event === 'repository') {
    return [
      'deleted',
      'archived',
      'unarchived',
      'renamed',
      'transferred',
    ].includes(delivery.action ?? '');
  }
  if (event === 'installation') {
    return (
      delivery.action === 'new_permissions_accepted' ||
      delivery.action === 'unsuspend' ||
      delivery.action === 'created'
    );
  }
  return event === 'push' && touchesWrangler(delivery);
}

/**
 * Leaves a deployment's checks with the scan queue, which runs them (a newer
 * job for the same repository replaces one that has not started). A failure is
 * logged, never raised.
 */
async function leaveJob(job: SuiteJob): Promise<void> {
  try {
    await enqueueScan(getDatabase(), getEnv().SCAN_QUEUE, {
      kind: 'deployment',
      ...job,
    });
  } catch (error) {
    console.error('suite job not kept', job.deployed.repo, error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const config = githubConfig();
  if (!config) {
    return new NextResponse(null, { status: 503 });
  }
  const body = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  if (!(await verifySignature(config.webhookSecret, body, signature))) {
    return new NextResponse(null, { status: 401 });
  }
  let delivery: Delivery;
  try {
    delivery = JSON.parse(body) as Delivery;
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const event = request.headers.get('x-github-event');
  const installationId = delivery.installation?.id;
  if (installationId === undefined) {
    return new NextResponse(null, { status: 202 });
  }
  const db = getDatabase();
  if (event === 'installation' && delivery.action === 'deleted') {
    await removeInstallation(db, installationId);
  } else if (event === 'deployment_status') {
    const deployed = classifyDeployment(delivery);
    const owner = await ownerOfInstallation(db, installationId);
    const deliveryId = request.headers.get('x-github-delivery');
    // A preview with no address or commit has nothing to check or to report on.
    const checkable =
      deployed !== null &&
      (deployed.environment === 'production' ||
        (deployed.url !== null && deployed.sha !== null));
    if (
      deployed &&
      checkable &&
      owner !== undefined &&
      // A repository whose checks are turned off is not checked: the delivery is dropped.
      !(await isRepoDisabled(db, deployed.repo)) &&
      (deliveryId === null || (await claimDelivery(db, deliveryId)))
    ) {
      await leaveJob({
        installationId,
        userId: owner,
        deployed,
        appUrl: appOrigin(request),
      });
    }
  } else if (event === 'issues') {
    await handleIssueEvent(
      db,
      config.slug,
      delivery,
      async () =>
        new GitHubApi(await installationToken(config, installationId)),
    );
  } else {
    const owner = await ownerOfInstallation(db, installationId);
    if (owner !== undefined) {
      if (rereadsInstallation(event, delivery)) {
        runInBackground(syncAsApp(db, config, owner, installationId));
      }
      // New rules apply to the live site as soon as they are on the default branch.
      const repo = delivery.repository?.full_name;
      if (
        event === 'push' &&
        repo &&
        touchesConfig(delivery) &&
        isDefaultBranchPush(delivery) &&
        // A repository whose file turns checks off still reads the push, to see
        // whether the flag changed; one switched off by a person does not.
        !(await isRepoSwitchedOff(db, repo))
      ) {
        await leaveJob({
          installationId,
          userId: owner,
          deployed: {
            environment: 'production',
            // A push of the file is no deployment, so it has no environment.
            name: '',
            repo,
            sha: delivery.after ?? null,
            url: null,
          },
          force: true,
          appUrl: appOrigin(request),
        });
      }
    }
  }
  return new NextResponse(null, { status: 202 });
}
