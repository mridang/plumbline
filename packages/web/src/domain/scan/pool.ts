/**
 * @packageDocumentation
 *
 * Running a scan from the page. The Worker on the server is asked to start a
 * scan (`POST /api/scans`), which checks the address and signs a scan id. Then
 * a few scan workers (Web Workers, see `worker.ts`) each load the page being
 * scanned and run the hints they are handed, one at a time, until every hint
 * has run. Outcomes are handed back as they come, so the page can show them
 * straight away.
 */

import { ensureOk, ProblemError } from '@/components/api/problem-message';

import type { HintInfo } from './catalogue';
import type { HintOutcome } from './engine';
import type { FromWorker, ToWorker } from './messages';

/** How many scan workers run side by side. */
const WORKERS = 6;

/** The worker as far as the pool uses it; tests hand in their own. */
export interface ScanWorker {
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null;
  postMessage(message: ToWorker): void;
  terminate(): void;
}

/** What the page is told as a scan goes. */
export interface ScanCallbacks {
  /** The page is loaded: where it ended up, and every hint that will run. */
  readonly onStart: (start: {
    readonly finalUrl: string;
    readonly status: number;
    readonly hints: readonly HintInfo[];
  }) => void;
  /** One hint has run. */
  readonly onOutcome: (outcome: HintOutcome) => void;
}

/** What a scan may be given; everything has a real default. */
export interface ScanOptions {
  readonly transport?: typeof fetch;
  readonly spawn?: () => ScanWorker;
  readonly workers?: number;
}

/** A real scan worker. */
function spawnWorker(): ScanWorker {
  return new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
    name: 'scan',
  }) as ScanWorker;
}

/** Ask the server to start a scan of `input`; its id, or a `ProblemError`. */
async function startScan(
  input: string,
  transport: typeof fetch,
): Promise<{ readonly id: string; readonly url: string }> {
  const response = await transport('/api/scans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: input }),
  });
  await ensureOk(response);
  return (await response.json()) as { id: string; url: string };
}

/** The next message from `worker`. */
function nextMessage(worker: ScanWorker): Promise<FromWorker> {
  return new Promise((resolve) => {
    worker.onmessage = (event) => resolve(event.data);
  });
}

/**
 * Scan `input` (a domain or a URL): start the scan, run every hint in the
 * workers and report each outcome as it comes. Resolves once every hint has
 * run; rejects with a `ProblemError` when the scan cannot start or the page
 * does not answer.
 */
export async function runScan(
  input: string,
  callbacks: ScanCallbacks,
  {
    transport = (url, init) => fetch(url, init),
    spawn = spawnWorker,
    workers = WORKERS,
  }: ScanOptions = {},
): Promise<void> {
  const scan = await startScan(input, transport);
  const load: ToWorker = { type: 'load', scanId: scan.id, url: scan.url };
  const pool: ScanWorker[] = [spawn()];
  try {
    pool[0]?.postMessage(load);
    const first = await nextMessage(pool[0] as ScanWorker);
    if (first.type !== 'ready') {
      throw new ProblemError(
        first.type === 'unreachable' ? first.detail : 'The scan stopped.',
      );
    }
    callbacks.onStart(first);
    const queue = first.hints.map((hint) => hint.id);
    let left = queue.length;
    await new Promise<void>((resolve) => {
      if (left === 0) {
        resolve();
        return;
      }
      /** Hand `worker` the next hint, if any are left. */
      const feed = (worker: ScanWorker): void => {
        const id = queue.shift();
        if (id !== undefined) {
          worker.postMessage({ type: 'run', id });
        }
      };
      const listen = (worker: ScanWorker): void => {
        worker.onmessage = (event) => {
          const message = event.data;
          if (message.type === 'unreachable') {
            // A spare worker that could not load the page sits out; the
            // others work through the queue.
            return;
          }
          if (message.type === 'done') {
            callbacks.onOutcome(message.outcome);
            left -= 1;
            if (left === 0) {
              resolve();
              return;
            }
          }
          feed(worker);
        };
      };
      listen(pool[0] as ScanWorker);
      feed(pool[0] as ScanWorker);
      for (let i = 1; i < Math.min(workers, queue.length + 1); i += 1) {
        const worker = spawn();
        pool.push(worker);
        listen(worker);
        worker.postMessage(load);
      }
    });
  } finally {
    for (const worker of pool) {
      worker.terminate();
    }
  }
}
