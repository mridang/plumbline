/**
 * What happens to the signed-in person's sites, as server-sent events.
 *
 *   GET /api/events → 200 text/event-stream (401 without a session)
 *
 * One stream per open dashboard, served by the person's `UserHub`. A client
 * that reconnects is replayed what it missed (`Last-Event-ID`, or `after`).
 */

import { requireLiveUid } from '@/domain/api/auth';
import type { HubNamespace } from '@/lib/cloudflare/broadcaster';
import { openEventStream } from '@/lib/cloudflare/event-stream';
import { parseResume } from '@/lib/cloudflare/sse';
import { getEnv } from '@/lib/core/runtime';

export const dynamic = 'force-dynamic';

/** Stream the person's events, resuming after the position the client last saw. */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireLiveUid(request);
  if (!auth.ok) {
    return auth.response;
  }
  return openEventStream(
    getEnv().USER_HUB as unknown as HubNamespace,
    String(auth.value),
    parseResume(
      request.headers.get('last-event-id'),
      new URL(request.url).searchParams.get('after'),
    ),
  );
}
