/**
 * @packageDocumentation
 *
 * The scan queue: how the checks of a deployment, of a change of rules and of
 * the scheduled re-check reach the scanner containers.
 *
 * The producers (the GitHub webhook and the cron trigger) put the job in
 * `pending_scans` and send a small message naming its key, then return: nothing
 * waits for a scan. Cloudflare Queues then runs this Worker's consumer for each
 * message, up to the consumer's `max_concurrency` at the same time, and the
 * consumer runs the job in a scanner Durable Object of its own (a name for each
 * job, so a container for each job). The numbers that must agree (the queue's
 * concurrency and the containers it may start) are set side by side in
 * `wrangler.jsonc`; a test holds them to each other.
 *
 * What makes it hold up:
 * - a newer job for the same key replaces an older one that has not started, so
 *   several deployments in a row cause one scan of the newest commit;
 * - the job lives in D1 until it has finished, not in the message, so a message
 *   that is retried, dead-lettered or lost never takes the job with it;
 * - a failed job is retried with a growing delay, then dead-lettered (logged),
 *   and the scheduled sweep sends any job that waits for too long again.
 */

import { createDatabase, type Database } from '@/domain/db/client';
import {
  claimPending,
  finishPending,
  putPending,
  releasePending,
  revivePending,
} from '@/domain/db/pending-scans';
import {
  keyOf,
  runJobThrough,
  ScanFailedError,
  type ScanJob,
  type ScannerNamespace,
} from '@/domain/suite/scanner';

/** The queue the scans go through; create it with `wrangler queues create`. */
export const SCAN_QUEUE_NAME = 'plumbline-scans';

/** Where a message goes after its last retry; it is logged there (see {@link handleScanQueue}). */
export const SCAN_DEAD_LETTER_NAME = 'plumbline-scans-dlq';

/** What a message says: which job to run. The job itself is in D1. */
export interface ScanMessage {
  readonly key: string;
  readonly seq: number;
}

/** The part of a queue binding the producers use. */
export interface ScanQueue {
  send(message: ScanMessage): Promise<unknown>;
}

/** How long a consumer may hold a job before another may take it: longer than a consumer invocation lives (15 minutes). */
export const LEASE_MS = 20 * 60 * 1000;

/** A job that has waited this long has lost its message and is sent again. */
export const STALE_MS = 60 * 60 * 1000;

/** The most jobs the sweep sends again in one go. */
const SWEEP_LIMIT = 50;

/** Seconds a message waits before its next try: 30, 60, 120 … up to ten minutes. */
export function backoffSeconds(attempts: number): number {
  return Math.min(600, 30 * 2 ** Math.max(0, attempts - 1));
}

/**
 * Leave `job` for the scanners. Resolves once it is stored and, when it needs
 * one, a message is sent; the scan itself runs later. A re-check of a site that
 * is already waiting sends nothing, and a deployment replaces the job already
 * waiting under its key. Returns whether a message was sent.
 */
export async function enqueueScan(
  db: Database,
  queue: ScanQueue | undefined,
  job: Readonly<ScanJob>,
  now: Date = new Date(),
): Promise<boolean> {
  if (!queue) {
    throw new ScanFailedError('Scans are not available.');
  }
  const key = keyOf(job);
  const seq = await putPending(
    db,
    key,
    JSON.stringify(job),
    now.toISOString(),
    {
      force: job.kind === 'deployment',
      staleBefore: new Date(now.getTime() - STALE_MS).toISOString(),
    },
  );
  if (seq === null) {
    return false;
  }
  await queue.send({ key, seq });
  return true;
}

/**
 * Send the jobs that have waited too long again, whatever became of their
 * messages. Run by the cron trigger, so no job is ever lost for good.
 */
export async function sweepPending(
  db: Database,
  queue: ScanQueue,
  now: Date = new Date(),
): Promise<number> {
  const revived = await revivePending(
    db,
    new Date(now.getTime() - STALE_MS).toISOString(),
    now.toISOString(),
    SWEEP_LIMIT,
  );
  for (const { key, seq } of revived) {
    console.error('scan job waited too long, sent again', key);
    await queue.send({ key, seq });
  }
  return revived.length;
}

/** What a consumer needs; the real ones are given by {@link handleScanQueue}. */
export interface ConsumerDeps {
  readonly db: Database;
  /** Runs a job in the scanner Durable Object called `name`; throws when it fails. */
  readonly run: (name: string, job: ScanJob) => Promise<void>;
  readonly now?: () => Date;
}

/**
 * Run the jobs of a batch (the queue is set to batches of one, so each job has
 * the consumer invocation and its 15 minutes to itself). A job that fails is
 * released and retried later; one that cannot be read is dropped, because no
 * retry would ever read it.
 */
export async function consumeScans(
  batch: Pick<MessageBatch<ScanMessage>, 'messages'>,
  deps: ConsumerDeps,
): Promise<void> {
  const now = deps.now ?? (() => new Date());
  for (const message of batch.messages) {
    await consumeScan(message, deps, now);
  }
}

/** Runs the job of one message, and acks, retries or drops the message. */
async function consumeScan(
  message: MessageBatch<ScanMessage>['messages'][number],
  deps: ConsumerDeps,
  now: () => Date,
): Promise<void> {
  const { key } = message.body;
  const at = now();
  const claimed = await claimPending(
    deps.db,
    key,
    at.toISOString(),
    new Date(at.getTime() - LEASE_MS).toISOString(),
  );
  if (claimed.state === 'gone') {
    // A newer message already ran the newest job for this key.
    message.ack();
    return;
  }
  if (claimed.state === 'busy') {
    message.retry({ delaySeconds: backoffSeconds(message.attempts) });
    return;
  }
  const { seq, job: text } = claimed.claim;
  let job: ScanJob;
  try {
    job = JSON.parse(text) as ScanJob;
  } catch (error) {
    console.error('scan job unreadable, dropped', key, error);
    await finishPending(deps.db, key, seq);
    message.ack();
    return;
  }
  try {
    await deps.run(`${key}#${seq}`, job);
    await finishPending(deps.db, key, seq);
    message.ack();
  } catch (error) {
    console.error('scan job failed', {
      key,
      attempt: message.attempts,
      error,
    });
    await releasePending(deps.db, key, seq).catch((error: unknown) =>
      console.error('scan job lease not released', key, error),
    );
    message.retry({ delaySeconds: backoffSeconds(message.attempts) });
  }
}

/**
 * The messages that ran out of retries. Each is logged so it can be found in
 * the Worker's logs; its job stays in D1, so the sweep sends it again later (a
 * job that fails for good is therefore tried again each hour, loudly, until
 * its cause is fixed).
 */
export function logDeadLetters(
  batch: Pick<MessageBatch<ScanMessage>, 'messages'>,
): void {
  for (const message of batch.messages) {
    console.error('scan job dead-lettered', message.body, {
      attempts: message.attempts,
    });
    message.ack();
  }
}

/** The Worker's `queue` handler: the scans and the dead-letter queue. */
export const handleScanQueue: ExportedHandlerQueueHandler<
  CloudflareEnv,
  ScanMessage
> = async (batch, env) => {
  if (batch.queue === SCAN_DEAD_LETTER_NAME) {
    logDeadLetters(batch);
    return;
  }
  const namespace = env.PROBE as unknown as ScannerNamespace | undefined;
  await consumeScans(batch, {
    db: createDatabase(env.DB),
    run: (name, job) => runJobThrough(namespace, name, job),
  });
};
