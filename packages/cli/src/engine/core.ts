import type { NetworkData } from 'hint';

import { catalogue, type CatalogueEntry, type HintInfo } from './catalogue.js';
import {
  loadPage,
  runHint,
  skipped,
  type FetchContent,
  type HintOutcome,
} from './engine.js';
import { fetchResource } from './network.js';
import { ScanRefused } from './scannable.js';

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

/** How a scan runs, whatever it runs on; every field is optional. */
export interface CoreOptions {
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
  /** Told why the page could not be loaded, for a log; the person asking is only told what they can act on. */
  readonly diagnose?: (error: unknown) => void;
}

/**
 * What a scan runs on: where its requests go out, and how the clients the checks
 * reach the network with are put in place. Node has one (a guard over its own
 * sockets); a Worker has another (the probe).
 */
export interface ScanEnvironment {
  /** The `fetch` every request of the scan goes through. */
  readonly fetch: typeof fetch;
  /** Throws when `url` is not an address to scan (it may resolve it). */
  assertScannable(url: URL): Promise<void>;
  /** Puts in place what the checks reach the network through; returns the function that removes it. */
  install(): () => void;
  /**
   * Whether an error loading the page is the environment's own fault (the probe is down), not
   * the site's: such an error is thrown, so the scan is tried again and not recorded as a site
   * that did not answer.
   */
  isFault?(error: unknown): boolean;
}

/**
 * A check that only said it could not test (a mail server that would not answer, a
 * connection that was refused) did not run: it is skipped, so the last result stands
 * and an open issue is not closed because the check could not look this time.
 */
export function neutralWhenUntested(outcome: HintOutcome): HintOutcome {
  if (
    outcome.status === 'passed' &&
    outcome.findings.length > 0 &&
    outcome.findings.every(
      (finding) =>
        finding.level === 'hint' &&
        /\bcould not (test|connect)\b/i.test(finding.message),
    )
  ) {
    return skipped(
      outcome,
      'It could not be tested this time (a server did not answer or refused the connection).',
      outcome.findings,
    );
  }
  return outcome;
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
  return error instanceof ScanRefused
    ? error.message
    : `${url.host} did not answer. Check the address and try again.`;
}

/**
 * Scan `address` on `environment`: fetch the page once, then run every check
 * against it, `concurrency` at a time, telling `emit` as each one finishes.
 * Always ends with an `end` event.
 */
export async function runScanWith(
  environment: ScanEnvironment,
  address: string,
  emit: (event: ScanEvent) => void,
  options: CoreOptions = {},
): Promise<void> {
  const uninstall = environment.install();
  try {
    const target = new URL(address);
    const fetchContent = cachedFetchContent(environment.fetch);
    let page;
    try {
      await environment.assertScannable(target);
      page = await loadPage(target, fetchContent);
    } catch (error) {
      options.diagnose?.(error);
      if (environment.isFault?.(error)) {
        throw error;
      }
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
        emit({ type: 'done', outcome: neutralWhenUntested(outcome) });
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
