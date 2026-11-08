import dns from 'node:dns/promises';

import { type CoreOptions, runScanWith } from './core.js';
import {
  GuardError,
  assertAllowed,
  guardedFetch,
  installGuard,
  isPublicAddress,
  type GuardOptions,
} from './guard.js';

export type { ScanEvent } from './core.js';

/** How a scan runs on Node; every field is optional. */
export interface RunOptions extends GuardOptions, CoreOptions {}

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

/**
 * Scan `address` from this process: fetch the page once, then run every check
 * against it, `concurrency` at a time, telling `emit` as each one finishes. The
 * guard (see `guard.ts`) is in place for the whole scan, so nothing a check
 * fetches or connects to can be on a private network. Always ends with an
 * `end` event.
 */
export async function runScan(
  address: string,
  emit: Parameters<typeof runScanWith>[2],
  options: RunOptions = {},
): Promise<void> {
  await runScanWith(
    {
      fetch: guardedFetch(options),
      assertScannable: (url) => assertPublicHost(url, options),
      install: () => installGuard(options),
    },
    address,
    emit,
    options,
  );
}
