/** A server-sent event. */
export interface SseFrame {
  /** The event name; omitted for the default `message` event. */
  readonly event?: string;
  /** The event id, which the browser sends back as `Last-Event-ID`. */
  readonly id?: string | number;
  /** The payload, serialised to a single line of JSON. */
  readonly data?: unknown;
}

/** The headers every event stream is sent with. */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
} as const;

/**
 * Encode an event for the wire.
 *
 * @param frame The event to encode.
 * @returns The `id:`, `event:` and `data:` lines followed by a blank line.
 */
export function encodeFrame(frame: SseFrame): string {
  const lines: string[] = [];
  if (frame.id !== undefined) {
    lines.push(`id: ${frame.id}`);
  }
  if (frame.event !== undefined) {
    lines.push(`event: ${frame.event}`);
  }
  if (frame.data !== undefined) {
    lines.push(`data: ${JSON.stringify(frame.data)}`);
  }
  return `${lines.join('\n')}\n\n`;
}

/**
 * Encode a comment that keeps idle connections open.
 *
 * @returns A comment line followed by a blank line.
 */
export function encodeHeartbeat(): string {
  return ': heartbeat\n\n';
}

/**
 * Read where a reconnecting client wants to resume.
 *
 * @param lastEventId The `Last-Event-ID` header, if any.
 * @param after The `after` query parameter, if any.
 * @returns The last sequence number the client has seen, or `null` for a client
 * that has seen none and wants only what happens from now on.
 */
export function parseResume(
  lastEventId: string | null | undefined,
  after?: string | null,
): number | null {
  for (const candidate of [lastEventId, after]) {
    if (
      candidate !== undefined &&
      candidate !== null &&
      /^\d+$/.test(candidate.trim())
    ) {
      return Number(candidate.trim());
    }
  }
  return null;
}
