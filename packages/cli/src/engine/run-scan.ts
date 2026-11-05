import dns from 'node:dns/promises';
import type { NetworkData } from 'hint';

import { catalogue, type CatalogueEntry, type HintInfo } from './catalogue.js';
import {
  loadPage,
  runHint,
  skipped,
  type FetchContent,
  type HintOutcome,
} from './engine.js';
import {
  GuardError,
  assertAllowed,
  guardedFetch,
  installGuard,
  isPublicAddress,
  type GuardOptions,
} from './guard.js';
import { fetchResource } from './network.js';

/**
 * Running every check against a site and reporting as they finish. The server
 * streams these events as lines of JSON to whoever asked for the scan:
 *
 * - `ready`: the page was fetched; carries every check's description so a
 *   page can lay out the whole list before any result is in.
 * - `done`: one check finished (passed, warned, failed or skipped).
 * - `unreachable`: the page could not be fetched; nothing else follows but `end`.
 * - `end`: the scan is over.
 */
export type ScanEvent =
  | {
      readonly type: 'ready';
      readonly finalUrl: string;
      readonly status: number;
      readonly hints: readonly HintInfo[];
    }
  | { readonly type: 'done'; readonly outcome: HintOutcome }
  | { readonly type: 'unreachable'; readonly detail: string }
  | { readonly type: 'end' };

/** How a scan runs; every field is optional. */
export interface RunOptions extends GuardOptions {
  /** How many checks run at once. */
  readonly concurrency?: number;
  /** The checks to run (bare ids); every check by default. */
  readonly only?: readonly string[];
  /** How long the whole scan may take, in milliseconds; checks not started by then are skipped. */
  readonly deadlineMs?: number;
  /** How long one check may take for one event, in milliseconds. */
  readonly hintTimeoutMs?: number;
  /** The checks to choose from; the hints package's own by default. */
  readonly entries?: readonly CatalogueEntry[];
}

/** The page's host, resolved: refuses a name that is not on the public internet. */
async function assertPublicHost(
  url: URL,
  options: GuardOptions,
): Promise<void> {
  assertAllowed(url, options);
  if (options.allowPrivate) {
    return;
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await dns.lookup(host, { all: true });
  const refused = addresses.find((entry) => !isPublicAddress(entry.address));
  if (refused) {
    throw new GuardError(
      `${host} resolves to ${refused.address}, which is not a public address`,
    );
  }
}

/** A fetch of a resource that asks the target once for an address however a check asks for it. */
function cachedFetchContent(fetcher: typeof fetch): FetchContent {
  const cache = new Map<string, Promise<NetworkData>>();
  return (url, headers = {}) => {
    const href = new URL(url).href;
    const key = `${href}\n${JSON.stringify(headers)}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = fetchResource(href, headers as Record<string, string>, fetcher);
      cache.set(key, pending);
    }
    return pending;
  };
}

/** Why the page could not be fetched, in words for the person who asked. */
function unreachableDetail(url: URL, error: unknown): string {
  return error instanceof GuardError
    ? error.message
    : `${url.host} did not answer. Check the address and try again.`;
}

/**
 * Scan `address`: fetch the page once, then run every check against it,
 * `concurrency` at a time, telling `emit` as each one finishes. The guard (see
 * `guard.ts`) is in place for the whole scan, so nothing a check fetches or
 * connects to can be on a private network. Always ends with an `end` event.
 */
export async function runScan(
  address: string,
  emit: (event: ScanEvent) => void,
  options: RunOptions = {},
): Promise<void> {
  const uninstall = installGuard(options);
  try {
    const target = new URL(address);
    const fetcher = guardedFetch(options);
    const fetchContent = cachedFetchContent(fetcher);
    let page;
    try {
      await assertPublicHost(target, options);
      page = await loadPage(target, fetchContent);
    } catch (error) {
      emit({ type: 'unreachable', detail: unreachableDetail(target, error) });
      return;
    }
    const wanted = options.only ? new Set(options.only) : undefined;
    const entries = (options.entries ?? catalogue()).filter(
      (entry) => !wanted || wanted.has(entry.info.id),
    );
    emit({
      type: 'ready',
      finalUrl: page.data.response.url,
      status: page.data.response.statusCode,
      hints: entries.map((entry) => entry.info),
    });
    const deadline = Date.now() + (options.deadlineMs ?? 180_000);
    const queue = [...entries];
    const worker = async (): Promise<void> => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        const outcome =
          Date.now() > deadline
            ? skipped(
                entry.info,
                'The scan ran out of time before this check started.',
              )
            : await runHint(entry, page, fetchContent, options.hintTimeoutMs);
        emit({ type: 'done', outcome });
      }
    };
    await Promise.all(
      Array.from({ length: options.concurrency ?? 8 }, () => worker()),
    );
  } finally {
    uninstall();
    emit({ type: 'end' });
  }
}
