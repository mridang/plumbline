import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { putPending } from '@/domain/db/pending-scans';
import {
  LEASE_MS,
  STALE_MS,
  backoffSeconds,
  consumeScans,
  enqueueScan,
  handleScanQueue,
  logDeadLetters,
  sweepPending,
  SCAN_DEAD_LETTER_NAME,
  type ScanMessage,
} from '@/domain/suite/queue';
import type { ScanJob } from '@/domain/suite/scanner';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const NOW = new Date('2026-01-01T12:00:00.000Z');

const deployment = (sha: string): ScanJob => ({
  kind: 'deployment',
  installationId: 5,
  userId: 7,
  deployed: {
    environment: 'production',
    name: 'production',
    repo: 'acme/site',
    sha,
    url: null,
  },
});

const recheck: ScanJob = {
  kind: 'recheck',
  userId: 7,
  host: 'a.test',
  repo: 'acme/a',
};

const setup = () => {
  const made = sqliteD1(...APP_MIGRATIONS);
  const db = createDatabase(made.d1);
  const sent: ScanMessage[] = [];
  const queue = {
    send: async (message: ScanMessage) => {
      sent.push(message);
    },
  };
  return { made, db, sent, queue };
};

/** A message that notes what the consumer did with it. */
const message = (body: ScanMessage, attempts = 1) => {
  const calls: string[] = [];
  return {
    calls,
    body,
    attempts,
    ack: () => calls.push('ack'),
    retry: (options?: { delaySeconds?: number }) =>
      calls.push(`retry ${options?.delaySeconds}`),
  };
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('backoffSeconds', () => {
  it('doubles from half a minute up to ten minutes', () => {
    expect([1, 2, 3, 4, 5, 6, 20].map(backoffSeconds)).toEqual([
      30, 60, 120, 240, 480, 600, 600,
    ]);
  });
});

describe('enqueueScan', () => {
  it('stores the job and sends one message naming its key', async () => {
    const { db, sent, queue } = setup();
    expect(await enqueueScan(db, queue, deployment('a'), NOW)).toBe(true);
    expect(sent).toEqual([{ key: 'deploy:acme/site', seq: 1 }]);
  });

  it('sends a message for each deployment, which then share the newest job', async () => {
    const { db, sent, queue } = setup();
    await enqueueScan(db, queue, deployment('a'), NOW);
    await enqueueScan(db, queue, deployment('b'), NOW);
    expect(sent.map((m) => m.seq)).toEqual([1, 2]);
    const ran: ScanJob[] = [];
    const first = message(sent[0] as ScanMessage);
    const second = message(sent[1] as ScanMessage);
    const run = async (_name: string, job: ScanJob) => {
      ran.push(job);
    };
    await consumeScans({ messages: [first, second] as never }, { db, run });
    expect(ran).toEqual([deployment('b')]);
    expect(first.calls).toEqual(['ack']);
    expect(second.calls).toEqual(['ack']);
  });

  it('sends a re-check once while one is waiting', async () => {
    const { db, sent, queue } = setup();
    expect(await enqueueScan(db, queue, recheck, NOW)).toBe(true);
    expect(await enqueueScan(db, queue, recheck, NOW)).toBe(false);
    expect(sent).toHaveLength(1);
  });

  it('sends a re-check again when the waiting one is stale', async () => {
    const { db, queue } = setup();
    await enqueueScan(db, queue, recheck, NOW);
    const later = new Date(NOW.getTime() + STALE_MS + 1);
    expect(await enqueueScan(db, queue, recheck, later)).toBe(true);
  });

  it('fails when there is no queue', async () => {
    const { db } = setup();
    await expect(
      enqueueScan(db, undefined, deployment('a'), NOW),
    ).rejects.toThrow('not available');
  });
});

describe('consumeScans', () => {
  it('runs the job in the object named by its key and number, then forgets it', async () => {
    const { db, sent, queue } = setup();
    await enqueueScan(db, queue, deployment('a'), NOW);
    const names: string[] = [];
    const msg = message(sent[0] as ScanMessage);
    await consumeScans(
      { messages: [msg] as never },
      {
        db,
        now: () => NOW,
        run: async (name) => {
          names.push(name);
        },
      },
    );
    expect(names).toEqual(['deploy:acme/site#1']);
    expect(msg.calls).toEqual(['ack']);
    const again = message({ key: 'deploy:acme/site', seq: 1 });
    await consumeScans(
      { messages: [again] as never },
      { db, now: () => NOW, run: async () => undefined },
    );
    expect(again.calls).toEqual(['ack']);
  });

  it('retries a failed job with a delay and keeps it for the retry', async () => {
    const { db, sent, queue } = setup();
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await enqueueScan(db, queue, deployment('a'), NOW);
    const failing = message(sent[0] as ScanMessage, 2);
    await consumeScans(
      { messages: [failing] as never },
      {
        db,
        now: () => NOW,
        run: async () => {
          throw new Error('container full');
        },
      },
    );
    expect(failing.calls).toEqual(['retry 60']);
    expect(log).toHaveBeenCalledWith(
      'scan job failed',
      expect.objectContaining({ key: 'deploy:acme/site', attempt: 2 }),
    );
    // The lease was given back, so the retry runs it at once.
    const ran: string[] = [];
    const retry = message(sent[0] as ScanMessage, 3);
    await consumeScans(
      { messages: [retry] as never },
      {
        db,
        now: () => NOW,
        run: async (name) => {
          ran.push(name);
        },
      },
    );
    expect(ran).toEqual(['deploy:acme/site#1']);
    expect(retry.calls).toEqual(['ack']);
  });

  it('waits while another consumer holds the job, and takes it once the lease has run out', async () => {
    const { db, sent, queue } = setup();
    await enqueueScan(db, queue, deployment('a'), NOW);
    let release: () => void = () => undefined;
    const running = consumeScans(
      { messages: [message(sent[0] as ScanMessage)] as never },
      {
        db,
        now: () => NOW,
        run: () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    const waiting = message(sent[0] as ScanMessage, 1);
    await consumeScans(
      { messages: [waiting] as never },
      { db, now: () => NOW, run: async () => undefined },
    );
    expect(waiting.calls).toEqual(['retry 30']);
    const expired = message(sent[0] as ScanMessage, 2);
    const names: string[] = [];
    await consumeScans(
      { messages: [expired] as never },
      {
        db,
        now: () => new Date(NOW.getTime() + LEASE_MS + 1),
        run: async (name) => {
          names.push(name);
        },
      },
    );
    expect(names).toEqual(['deploy:acme/site#1']);
    release();
    await running;
  });

  it('drops a job that cannot be read, since no retry would read it either', async () => {
    const { db } = setup();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await putPending(db, 'bad', '{nope', NOW.toISOString(), {
      force: true,
      staleBefore: NOW.toISOString(),
    });
    const msg = message({ key: 'bad', seq: 1 });
    const run = jest.fn(async () => undefined);
    await consumeScans(
      { messages: [msg] as never },
      { db, now: () => NOW, run },
    );
    expect(run).not.toHaveBeenCalled();
    expect(msg.calls).toEqual(['ack']);
  });
});

describe('sweepPending', () => {
  it('sends again a job that waited too long, and only once for a while', async () => {
    const { db, sent, queue } = setup();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await enqueueScan(db, queue, deployment('a'), NOW);
    const later = new Date(NOW.getTime() + STALE_MS + 1);
    expect(await sweepPending(db, queue, later)).toBe(1);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({ key: 'deploy:acme/site', seq: 1 });
    expect(await sweepPending(db, queue, later)).toBe(0);
  });

  it('leaves a job that has not waited long', async () => {
    const { db, queue } = setup();
    await enqueueScan(db, queue, deployment('a'), NOW);
    expect(await sweepPending(db, queue, NOW)).toBe(0);
  });
});

describe('logDeadLetters', () => {
  it('logs each message that ran out of retries and acknowledges it', () => {
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const msg = message({ key: 'deploy:acme/site', seq: 4 }, 6);
    logDeadLetters({ messages: [msg] as never });
    expect(log).toHaveBeenCalledWith(
      'scan job dead-lettered',
      { key: 'deploy:acme/site', seq: 4 },
      { attempts: 6 },
    );
    expect(msg.calls).toEqual(['ack']);
  });
});

describe('handleScanQueue', () => {
  it('logs the dead-letter queue and runs the scan queue through the scanner objects', async () => {
    const made = sqliteD1(...APP_MIGRATIONS);
    const db = createDatabase(made.d1);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetched: { name: string; body: unknown }[] = [];
    let named = '';
    const env = {
      DB: made.d1,
      SCANNER: {
        idFromName: (name: string) => {
          named = name;
          return name;
        },
        get: () => ({
          fetch: async (request: Request) => {
            fetched.push({ name: named, body: await request.json() });
            return new Response(null, { status: 200 });
          },
        }),
      },
    };
    await enqueueScan(db, { send: async () => undefined }, recheck, NOW);
    const live = message({ key: 'site:7:a.test', seq: 1 });
    await handleScanQueue(
      { queue: 'plumbline-scans', messages: [live] } as never,
      env as never,
      {} as never,
    );
    expect(fetched).toEqual([{ name: 'site:7:a.test#1', body: recheck }]);
    expect(live.calls).toEqual(['ack']);
    const dead = message({ key: 'x', seq: 1 });
    await handleScanQueue(
      { queue: SCAN_DEAD_LETTER_NAME, messages: [dead] } as never,
      env as never,
      {} as never,
    );
    expect(dead.calls).toEqual(['ack']);
    expect(fetched).toHaveLength(1);
  });

  it('retries the job when no scanner is bound', async () => {
    const made = sqliteD1(...APP_MIGRATIONS);
    const db = createDatabase(made.d1);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await enqueueScan(db, { send: async () => undefined }, recheck, NOW);
    const live = message({ key: 'site:7:a.test', seq: 1 });
    await handleScanQueue(
      { queue: 'plumbline-scans', messages: [live] } as never,
      { DB: made.d1 } as never,
      {} as never,
    );
    expect(live.calls).toEqual(['retry 30']);
  });
});
