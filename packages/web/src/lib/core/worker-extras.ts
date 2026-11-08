/**
 * @packageDocumentation
 *
 * What this app adds to the Worker in `src/worker.ts`, which is the same in
 * every app: handlers besides `fetch` (a cron trigger's `scheduled`), and the
 * Workflow or Durable Object classes the Worker must export by name. This app
 * has a cron trigger that queues the re-check of the sites found through
 * GitHub and re-reads stale installations (`domain/suite/scheduled.ts`), and
 * the consumer of the scan queue (`domain/suite/queue.ts`).
 */

import { handleScanQueue } from '@/domain/suite/queue';
import { scheduled } from '@/domain/suite/scheduled';

/** The Durable Object that streams a person's live updates (see `lib/cloudflare/user-hub.ts`). */
export { UserHub } from '@/lib/cloudflare/user-hub';

/** The Durable Object that runs the scanner container (see `lib/cloudflare/scanner-container.ts`). */
export { ScannerContainer } from '@/lib/cloudflare/scanner-container';

/** The Durable Object that runs the checks itself and asks a small probe container for the rest (see `lib/cloudflare/probe-scanner.ts`). */
export { ProbeScanner } from '@/lib/cloudflare/probe-scanner';

/** The handlers this app adds to the Worker, besides `fetch`. */
const extraHandlers: Partial<ExportedHandler<CloudflareEnv>> = {
  scheduled,
  // The scan queue's consumer, and the dead-letter queue's.
  queue: handleScanQueue as ExportedHandlerQueueHandler<CloudflareEnv>,
};

export default extraHandlers;
