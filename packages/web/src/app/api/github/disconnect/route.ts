/**
 * Disconnect the signed-in person's GitHub account: the link, the
 * installations and the repositories found are forgotten. Domains already
 * added stay, and the app stays installed on GitHub until they uninstall it
 * there.
 *
 *   POST /api/github/disconnect → 204
 */

import { NextResponse } from 'next/server';

import { getDatabase } from '@/domain/db/client';
import { unlinkAccount } from '@/domain/db/github';
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
  await unlinkAccount(getDatabase(), user.id);
  return new NextResponse(null, { status: 204 });
}
