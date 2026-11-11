import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { cloudflareWorkersStub } from '../../helpers/cloudflare-workers-stub';
import { APP_MIGRATIONS } from '../core/db/migrations';
import { sqliteD1 } from '../core/db/sqlite-d1';

jest.unstable_mockModule('cloudflare:workers', cloudflareWorkersStub, {
  virtual: true,
} as never);

const { UserHub, MAX_REPLAY } = await import('@/lib/cloudflare/user-hub');

class TestHub extends UserHub {
  get open(): number {
    return this.clients.size;
  }
  get pinging(): boolean {
    return this.timer !== null;
  }
  closeAll(): void {
    for (const client of this.clients) {
      void client.abort();
    }
  }
}

const PERSON = '7';
const hubs: TestHub[] = [];

afterEach(() => {
  for (const hub of hubs.splice(0)) {
    hub.closeAll();
    hub.heartbeat();
  }
});

/** A hub over a fresh database, and a way to append events for people. */
function setup() {
  const { d1, raw } = sqliteD1(...APP_MIGRATIONS);
  const hub = new TestHub({} as never, { DB: d1 } as never);
  hubs.push(hub);
  const append = (from: number, to: number, user = Number(PERSON)) => {
    for (let n = from; n <= to; n += 1) {
      raw
        .prepare(
          "INSERT INTO live_events (user_id, payload, created_at) VALUES (?, ?, 'now')",
        )
        .run(user, JSON.stringify({ type: 'started', n }));
    }
  };
  const open = (headers: Record<string, string> = {}, query = '') =>
    hub.fetch(
      new Request(`https://hub.internal/events/people/${PERSON}${query}`, {
        headers,
      }),
    );
  return { hub, append, open };
}

/** Read frames from a stream until `wanted` have arrived. */
async function readSome(response: Response, wanted: number): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  while ((text.match(/\n\n/g) ?? []).length < wanted) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    text += decoder.decode(value);
  }
  reader.releaseLock();
  return text;
}

const idsOf = (text: string) =>
  [...text.matchAll(/^id: (\d+)$/gm)].map((match) => Number(match[1]));

describe('UserHub', () => {
  it('opens an event stream with the right headers', async () => {
    const { open } = setup();
    const response = await open();
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-cache');
  });

  it('refuses a request that names no person', async () => {
    const { hub } = setup();
    const res = await hub.fetch(new Request('https://hub.internal/'));
    expect(res.status).toBe(400);
  });

  it('replays what was missed after the resume position, then streams new events', async () => {
    const { hub, append, open } = setup();
    append(1, 3);
    const response = await open({ 'Last-Event-ID': '1' });
    append(4, 4);
    await hub.notify(PERSON);
    const text = await readSome(response, 3);
    expect(idsOf(text)).toEqual([2, 3, 4]);
    expect(text).toContain('event: live');
    expect(text).toContain('"type":"started"');
  });

  it('streams only what is new to a client that has seen nothing', async () => {
    const { hub, append, open } = setup();
    append(1, 5);
    const response = await open();
    append(6, 6);
    await hub.notify(PERSON);
    const text = await readSome(response, 1);
    expect(idsOf(text)).toEqual([6]);
    expect(text).not.toContain('event: reset');
  });

  it('resumes from the after parameter when there is no header', async () => {
    const { append, open } = setup();
    append(1, 4);
    const text = await readSome(await open({}, '?after=3'), 1);
    expect(idsOf(text)).toEqual([4]);
  });

  it('does not repeat events across notifications', async () => {
    const { hub, append, open } = setup();
    append(1, 1);
    const response = await open({ 'Last-Event-ID': '1' });
    append(2, 2);
    await hub.notify(PERSON);
    await hub.notify(PERSON);
    const text = await readSome(response, 1);
    expect(text.match(/^id: /gm)).toHaveLength(1);
  });

  it('does not stream another person’s events', async () => {
    const { hub, append, open } = setup();
    const response = await open({ 'Last-Event-ID': '0' });
    append(1, 1, 99);
    append(2, 2);
    await hub.notify(PERSON);
    expect(idsOf(await readSome(response, 1))).toEqual([2]);
  });

  it('sends a heartbeat to open clients', async () => {
    const { hub, open } = setup();
    const response = await open({ 'Last-Event-ID': '0' });
    hub.heartbeat();
    expect(await readSome(response, 1)).toBe(': heartbeat\n\n');
  });

  it('lets go of a client that has gone away at once, without waiting for the next ping', async () => {
    const { hub, open } = setup();
    const response = await open({ 'Last-Event-ID': '0' });
    expect(hub.open).toBe(1);
    await response.body!.cancel();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(hub.open).toBe(0);
  });

  it('stops pinging when the last client has gone, and starts again for the next', async () => {
    const { hub, open } = setup();
    const first = await open({ 'Last-Event-ID': '0' });
    expect(hub.pinging).toBe(true);
    await first.body!.cancel();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(hub.pinging).toBe(false);
    await open({ 'Last-Event-ID': '0' });
    expect(hub.pinging).toBe(true);
  });

  it('keeps pinging while another client is still there', async () => {
    const { hub, open } = setup();
    const gone = await open({ 'Last-Event-ID': '0' });
    await open({ 'Last-Event-ID': '0' });
    await gone.body!.cancel();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(hub.open).toBe(1);
    expect(hub.pinging).toBe(true);
  });

  it('sends a reset when too many events were missed', async () => {
    const { append, open } = setup();
    append(1, MAX_REPLAY + 20);
    const text = await readSome(await open({ 'Last-Event-ID': '0' }), 1);
    expect(text).toContain('event: reset');
    expect(text).not.toContain('event: live');
  });

  it('does nothing on notify when nobody is listening', async () => {
    await expect(setup().hub.notify('99')).resolves.toBeUndefined();
  });
});
