/**
 * @packageDocumentation
 *
 * The `UserHub` Durable Object: one per person, it holds the open
 * server-sent-event streams of the browsers they have open and pushes what
 * happens to their sites to them. It stores nothing itself; the `live_events`
 * log in D1 is the source of truth, so a client that reconnects is replayed
 * from the log after the position it last saw.
 *
 * It reads the `live_events` table directly (a pure library cannot reach into
 * the domain), and sends each event's stored JSON as it was recorded.
 */

import { DurableObject } from 'cloudflare:workers';
import { encodeFrame, encodeHeartbeat, parseResume, SSE_HEADERS } from './sse';

/** The most missed facts replayed to a reconnecting client before it must reload. */
export const MAX_REPLAY = 500;

/** The frames a stream may have queued before its client is considered too slow. */
const MAX_BACKLOG = MAX_REPLAY + 64;

/** How often idle streams are pinged, in milliseconds. */
const HEARTBEAT_MS = 30_000;

/** A recorded fact and its position in the log. */
interface LogRow {
  readonly id: number;
  readonly payload: string;
}

/** Holds a repository's open event streams and pushes new facts to them. */
export class UserHub extends DurableObject<CloudflareEnv> {
  protected readonly clients = new Set<
    WritableStreamDefaultWriter<Uint8Array>
  >();
  protected position = 0;
  protected person: string | null = null;
  private readonly encoder = new TextEncoder();
  protected timer: ReturnType<typeof setInterval> | null = null;

  /**
   * Open an event stream, replaying what the client missed.
   * @param request - The stream request, naming the repository in its path's last segment.
   * @returns The streaming response.
   */
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userId = decodeURIComponent(
      url.pathname.split('/').findLast(Boolean) ?? '',
    );
    if (userId === '') {
      return new Response('Missing person.', { status: 400 });
    }
    this.person = userId;
    const resume = parseResume(
      request.headers.get('Last-Event-ID'),
      url.searchParams.get('after'),
    );
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>(
      undefined,
      { highWaterMark: MAX_BACKLOG },
    );
    const writer = writable.getWriter();

    // A client with nothing seen is a fresh page load: it already has the
    // current state, so it gets only what happens next, not the whole log.
    let sent = resume ?? (await this.latest(userId));
    const missed =
      resume === null ? [] : await this.since(userId, resume, MAX_REPLAY + 1);
    if (missed.length > MAX_REPLAY) {
      sent = await this.latest(userId);
      this.write(writer, encodeFrame({ event: 'reset', id: sent, data: {} }));
    } else {
      for (const row of missed) {
        this.write(writer, this.eventFrame(row));
        sent = row.id;
      }
    }
    this.position = Math.max(this.position, sent);
    this.clients.add(writer);
    // A client that goes away (a closed tab, a dropped connection) ends the
    // writer; let go of it at once, not at the next ping or event.
    void writer.closed.then(
      () => this.release(writer),
      () => this.release(writer),
    );
    this.startHeartbeat();
    return new Response(readable, { headers: SSE_HEADERS });
  }

  /**
   * Push facts recorded since the last position to every open stream.
   * @param userId - The repository whose log grew.
   */
  async notify(userId: string): Promise<void> {
    if (this.clients.size === 0) {
      return;
    }
    const fresh = await this.since(userId, this.position, MAX_REPLAY);
    for (const row of fresh) {
      this.broadcast(this.eventFrame(row));
      this.position = row.id;
    }
  }

  /** Ping every open stream, dropping the ones that have closed. */
  heartbeat(): void {
    this.broadcast(encodeHeartbeat());
    if (this.clients.size === 0) {
      this.stopHeartbeat();
    }
  }

  /** Forget a writer whose client has gone, and stop pinging when none is left. */
  private release(writer: WritableStreamDefaultWriter<Uint8Array>): void {
    this.clients.delete(writer);
    if (this.clients.size === 0) {
      this.stopHeartbeat();
    }
  }

  private async since(
    userId: string,
    after: number,
    limit: number,
  ): Promise<readonly LogRow[]> {
    const { results } = await this.env.DB.prepare(
      'select id, payload from live_events where user_id = ?1 and id > ?2 order by id asc limit ?3',
    )
      .bind(Number(userId), after, limit)
      .all<LogRow>();
    return results;
  }

  private async latest(userId: string): Promise<number> {
    const row = await this.env.DB.prepare(
      'select max(id) as id from live_events where user_id = ?1',
    )
      .bind(Number(userId))
      .first<{ id: number | null }>();
    return row?.id ?? 0;
  }

  private eventFrame(row: LogRow): string {
    return encodeFrame({
      event: 'live',
      id: row.id,
      data: JSON.parse(row.payload),
    });
  }

  private write(
    writer: WritableStreamDefaultWriter<Uint8Array>,
    frame: string,
  ): void {
    writer.write(this.encoder.encode(frame)).catch(() => {
      this.release(writer);
    });
  }

  private broadcast(frame: string): void {
    for (const writer of this.clients) {
      if (writer.desiredSize === null || writer.desiredSize <= 0) {
        this.clients.delete(writer);
        writer.abort().catch(() => undefined);
        continue;
      }
      this.write(writer, frame);
    }
  }

  private startHeartbeat(): void {
    this.timer ??= setInterval(() => void this.heartbeat(), HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
