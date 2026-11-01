/**
 * GitHub's deliveries for the app. Every one is checked against the shared
 * secret before anything is read. An installation that was removed is
 * forgotten; a change to an installation's repositories, or a push to a
 * Wrangler configuration, reads the installation again so the deployed hosts
 * stay right. Anything else is acknowledged and ignored.
 */

import { NextResponse } from 'next/server';

import { getDatabase } from '@/domain/db/client';
import { ownerOfInstallation, removeInstallation } from '@/domain/db/github';
import { touchesWrangler, type Delivery } from '@/domain/github/deployments';
import { githubConfig, syncAsApp } from '@/domain/github/service';
import { verifySignature } from '@/domain/github/webhook';
import { runInBackground } from '@/lib/core/runtime';

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
  } else if (
    event === 'installation_repositories' ||
    (event === 'push' && touchesWrangler(delivery))
  ) {
    const owner = await ownerOfInstallation(db, installationId);
    if (owner !== undefined) {
      runInBackground(syncAsApp(db, config, owner, installationId));
    }
  }
  return new NextResponse(null, { status: 202 });
}
