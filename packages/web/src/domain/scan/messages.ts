/**
 * @packageDocumentation
 *
 * What the page and its scan workers say to each other. The page starts a
 * scan, then each worker loads the page being scanned and runs the hints it is
 * handed one at a time (see `worker.ts` and `pool.ts`).
 */

import type { HintInfo } from './catalogue';
import type { HintOutcome } from './engine';

/** Page to worker: fetch and parse the page this scan is of. */
export interface LoadMessage {
  readonly type: 'load';
  readonly scanId: string;
  readonly url: string;
}

/** Page to worker: run this hint. */
export interface RunMessage {
  readonly type: 'run';
  readonly id: string;
}

/** What the page sends a worker. */
export type ToWorker = LoadMessage | RunMessage;

/** Worker to page: the page is loaded, and these are the hints there are. */
export interface ReadyMessage {
  readonly type: 'ready';
  readonly finalUrl: string;
  readonly status: number;
  readonly hints: readonly HintInfo[];
}

/** Worker to page: the page being scanned could not be fetched. */
export interface UnreachableMessage {
  readonly type: 'unreachable';
  readonly detail: string;
}

/** Worker to page: what a hint came to. */
export interface DoneMessage {
  readonly type: 'done';
  readonly outcome: HintOutcome;
}

/** What a worker sends the page. */
export type FromWorker = ReadyMessage | UnreachableMessage | DoneMessage;
