/**
 * @packageDocumentation
 *
 * A scan worker: a Web Worker that loads the page being scanned and runs the
 * hints it is handed, one at a time, so the browser's refusals are known to be
 * the running hint's own (see `engine.ts`). Several run side by side (see
 * `pool.ts`). Every request goes through the Worker on the server (see
 * `relay.ts`), including the ones hints make with `fetch` themselves.
 */

import './globals';

import type { NetworkData } from 'hint';

import { catalogue, type CatalogueEntry } from './catalogue';
import { loadPage, runHint, type FetchContent, type Page } from './engine';
import type { FromWorker, ToWorker } from './messages';
import { fetchResource } from './network';
import { relayFetch, relayFor, RelayError } from './relay';

/** The worker's own scope, as far as it is used. */
interface WorkerScope {
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
  postMessage(message: FromWorker): void;
}

const scope = globalThis as unknown as WorkerScope;

/** The page's own `fetch`, kept for addresses the relay does not handle. */
const localFetch = globalThis.fetch.bind(globalThis);

const entries = new Map<string, CatalogueEntry>(
  catalogue().map((entry) => [entry.info.id, entry]),
);

let page: Page | undefined;
let fetchContent: FetchContent | undefined;

/** A `fetchContent` that makes each distinct request once. */
function cachedFetchContent(scanId: string): FetchContent {
  const relay = relayFor(scanId, localFetch);
  const cache = new Map<string, Promise<NetworkData>>();
  return (url, headers = {}) => {
    const href = new URL(url).href;
    const key = `${href}\n${JSON.stringify(headers)}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = fetchResource(href, headers as Record<string, string>, relay);
      cache.set(key, pending);
    }
    return pending;
  };
}

/** Load the page, and say so. */
async function load(scanId: string, url: string): Promise<void> {
  globalThis.fetch = relayFetch(relayFor(scanId, localFetch), localFetch);
  fetchContent = cachedFetchContent(scanId);
  try {
    page = await loadPage(new URL(url), fetchContent);
  } catch (error) {
    scope.postMessage({
      type: 'unreachable',
      detail:
        error instanceof RelayError
          ? error.message
          : `${new URL(url).host} did not answer. Check the address and try again.`,
    });
    return;
  }
  scope.postMessage({
    type: 'ready',
    finalUrl: page.data.response.url,
    status: page.data.response.statusCode,
    hints: [...entries.values()].map((entry) => entry.info),
  });
}

/** Run one hint, and say what it found. */
async function run(id: string): Promise<void> {
  const entry = entries.get(id);
  if (!entry || !page || !fetchContent) {
    return;
  }
  scope.postMessage({
    type: 'done',
    outcome: await runHint(entry, page, fetchContent),
  });
}

scope.onmessage = (event) => {
  const message = event.data;
  void (message.type === 'load'
    ? load(message.scanId, message.url)
    : run(message.id));
};
