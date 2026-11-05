/**
 * @packageDocumentation
 *
 * What this app adds to the Worker in `src/worker.ts`, which is the same in
 * every app: handlers besides `fetch` (a cron trigger's `scheduled`), and the
 * Workflow or Durable Object classes the Worker must export by name. This app
 * has a cron trigger: the daily re-check of the sites found through GitHub
 * (`domain/suite/scheduled.ts`).
 */

import { scheduled } from '@/domain/suite/scheduled';

/** The Durable Object that streams a person's live updates (see `lib/cloudflare/user-hub.ts`). */
export { UserHub } from '@/lib/cloudflare/user-hub';

/** The Durable Object that runs the TLS prober container (see `lib/cloudflare/probe-container.ts`). */
export { ProbeContainer } from '@/lib/cloudflare/probe-container';

/** The Durable Object that runs the scanner container (see `lib/cloudflare/scanner-container.ts`). */
export { ScannerContainer } from '@/lib/cloudflare/scanner-container';

/** The handlers this app adds to the Worker, besides `fetch`. */
const extraHandlers: Partial<ExportedHandler<CloudflareEnv>> = { scheduled };

export default extraHandlers;
