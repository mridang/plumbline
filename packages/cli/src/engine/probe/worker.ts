/**
 * @packageDocumentation
 *
 * A scan for a runtime that has no sockets of its own (a Cloudflare Worker or
 * Durable Object): every check runs here, in this process, and everything that
 * needs a real connection is asked of the probe (see `probe/README.md`).
 */

import './shims.js';

import { runScanWith, type CoreOptions, type ScanEvent } from '../core.js';
import { assertScannable } from '../scannable.js';
import type { ProbeClient } from './client.js';
import { probeFetch } from './fetch.js';
import { ensureRoots, withProbe } from './install.js';
import { ProbeUnavailable } from './protocol.js';

/** Scan `address` with the checks running here and `client` doing the network work. */
export async function runWorkerScan(
  client: ProbeClient,
  address: string,
  emit: (event: ScanEvent) => void,
  options: CoreOptions = {},
): Promise<void> {
  const fetcher = probeFetch(client);
  await withProbe(client, () =>
    runScanWith(
      {
        fetch: fetcher,
        isFault: (error) => error instanceof ProbeUnavailable,
        // The probe refuses an address that is not public when it connects.
        assertScannable: async (url) => {
          assertScannable(url);
          await ensureRoots(client);
        },
        install: () => {
          const original = globalThis.fetch;
          // The checks that fetch the site's own files with the global `fetch` get the probe's
          // view of it; the scan's other calls (DNS-over-HTTPS) keep the real one.
          globalThis.fetch = ((input, init) =>
            isSiteRequest(input)
              ? fetcher(input, init)
              : original(input, init)) as typeof fetch;
          return () => {
            globalThis.fetch = original;
          };
        },
      },
      address,
      emit,
      options,
    ),
  );
}

/** Whether a request is for something other than the DNS-over-HTTPS resolver. */
function isSiteRequest(input: Parameters<typeof fetch>[0]): boolean {
  const url = new URL(input instanceof Request ? input.url : String(input));
  return url.hostname !== 'cloudflare-dns.com';
}
