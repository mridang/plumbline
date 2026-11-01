/**
 * Read the signed-in person's GitHub installations again, so repositories
 * added since, and changes to where they are deployed, show up.
 *
 *   POST /api/github/sync → 200 {repositories, deployed, domainsAdded}
 */

import { NextResponse } from 'next/server';

import { getDatabase } from '@/domain/db/client';
import { githubConfig, syncAllOf } from '@/domain/github/service';
import { crossSiteRefusal } from '@/lib/core/auth';
import { getCurrentUser } from '@/lib/core/auth/current-user';

export async function POST(request: Request): Promise<NextResponse> {
  const refused = crossSiteRefusal(request);
  if (refused) {
    return refused;
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }
  const config = githubConfig();
  if (!config) {
    return NextResponse.json(
      { error: 'GitHub is not set up on this site.' },
      { status: 503 },
    );
  }
  return NextResponse.json(await syncAllOf(getDatabase(), config, user.id));
}
