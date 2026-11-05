/**
 * GitHub's deliveries for the app. Every one is checked against the shared
 * secret before anything is read. An installation that was removed is
 * forgotten; a change to an installation's repositories or permissions, or a
 * push to a Wrangler configuration, reads the installation again so the
 * deployed hosts stay right. A push of `plumbline.yaml` to the default branch
 * checks the live site again under the new rules, and an issue a person
 * closes, reopens or deletes is noted so the app treats it accordingly. A successful deployment runs the server-side checks, once per
 * delivery (GitHub retries are recognised by their id): on the repository's
 * sites when it is the live site, and on the deployment's own address when it
 * is a preview. Anything else is acknowledged and ignored.
 */

import { NextResponse } from 'next/server';

import { getDatabase } from '@/domain/db/client';
import { ownerOfInstallation, removeInstallation } from '@/domain/db/github';
import { claimDelivery } from '@/domain/db/suite';
import {
  isDefaultBranchPush,
  touchesConfig,
  touchesWrangler,
  type Delivery,
} from '@/domain/github/deployments';
import { githubConfig, syncAsApp } from '@/domain/github/service';
import { verifySignature } from '@/domain/github/webhook';
import { classifyDeployment } from '@/domain/suite/deploy';
import { handleDeployment } from '@/domain/suite/github-run';
import { handleIssueEvent } from '@/domain/suite/issue-events';
import { createLive } from '@/domain/live/live';
import { readLimits } from '@/domain/suite/limits';
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
  if (event === 'installation') {
    return (
      delivery.action === 'new_permissions_accepted' ||
      delivery.action === 'unsuspend' ||
      delivery.action === 'created'
    );
  }
  return event === 'push' && touchesWrangler(delivery);
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
    if (
      deployed &&
      owner !== undefined &&
      (deliveryId === null || (await claimDelivery(db, deliveryId)))
    ) {
      runInBackground(
        handleDeployment(db, config, installationId, owner, deployed, {
          limits: readLimits(getEnv()),
          live: createLive(db, getEnv()),
          appUrl: appOrigin(request),
        }),
      );
    }
  } else if (event === 'issues') {
    await handleIssueEvent(db, config.slug, delivery);
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
        isDefaultBranchPush(delivery)
      ) {
        runInBackground(
          handleDeployment(
            db,
            config,
            installationId,
            owner,
            {
              environment: 'production',
              repo,
              sha: delivery.after ?? null,
              url: null,
            },
            {
              force: true,
              limits: readLimits(getEnv()),
              live: createLive(db, getEnv()),
              appUrl: appOrigin(request),
            },
          ),
        );
      }
    }
  }
  return new NextResponse(null, { status: 202 });
}
