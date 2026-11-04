/**
 * @packageDocumentation
 *
 * Opens a person's server-sent-event stream from its hub.
 */

import type { HubNamespace } from './broadcaster';
import { SSE_HEADERS } from './sse';

/**
 * Ask the person's hub for an event stream, resuming after a position.
 *
 * @param hubs The hub namespace.
 * @param userId The person to stream.
 * @param resume The last sequence number the client has seen, or `null` to stream only what is new.
 * @returns The streaming response.
 */
export async function openEventStream(
  hubs: HubNamespace,
  userId: string,
  resume: number | null,
): Promise<Response> {
  const hub = hubs.get(hubs.idFromName(userId));
  const upstream = await hub.fetch(
    `https://hub.internal/events/people/${encodeURIComponent(userId)}`,
    { headers: resume === null ? {} : { 'Last-Event-ID': String(resume) } },
  );
  return new Response(upstream.body, { headers: SSE_HEADERS });
}
