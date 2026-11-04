/**
 * Every site of the signed-in person grouped by repository, with how each
 * stands now. The dashboard reads it again whenever its stream was reset.
 *
 *   GET /api/overview → 200 (401 without a session)
 */

import { requireLiveUid } from '@/domain/api/auth';
import { getDatabase } from '@/domain/db/client';
import { overviewOf } from '@/domain/db/live';

export const dynamic = 'force-dynamic';

/** The person's overview. */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireLiveUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  return Response.json(
    { repos: await overviewOf(getDatabase(), auth.value) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
