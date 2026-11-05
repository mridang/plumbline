/**
 * @packageDocumentation
 *
 * How a scan in the browser makes the TLS handshakes its checks inspect: each
 * one is posted to the Worker (`POST /api/scans/{id}/probes`), which has the
 * prober container make it. The hints package's `tlsProbe.connect` is pointed
 * here, so the TLS checks run unchanged.
 */

import { problemMessage } from '@/components/api/problem-message';
import type {
  RemoteCall,
  RemoteHandshake,
  RemoteRequest,
} from '@mridang/webhint-hint-plumbline/dist/lib/tls/remote.js';

/** The handshake failed or the prober is not there, as the Worker said. */
export class ProbeFailure extends Error {
  public readonly status: number;

  public constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ProbeFailure';
    this.status = status;
  }
}

/** A prober call for the scan `scanId`, posting with `transport` (the page's own `fetch`). */
export function probeFor(
  scanId: string,
  transport: typeof fetch = (input, init) => fetch(input, init),
): RemoteCall {
  const endpoint = `/api/scans/${encodeURIComponent(scanId)}/probes`;
  return async (request: RemoteRequest): Promise<RemoteHandshake> => {
    const response = await transport(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new ProbeFailure(response.status, await problemMessage(response));
    }
    return (await response.json()) as RemoteHandshake;
  };
}

/**
 * A prober call that tells apart a handshake the server refused (an answer,
 * which rejects as it is) from a prober that cannot be reached: not there,
 * rate limited, or the scan over. The second must show the check as not run,
 * not as a fault of the site, so it calls `refuse`, which does not return.
 */
export function refusingWhenUnavailable(
  call: RemoteCall,
  refuse: (what: string) => never,
): RemoteCall {
  return async (request) => {
    try {
      return await call(request);
    } catch (error) {
      if (error instanceof ProbeFailure && error.status !== 502) {
        refuse('reach the TLS prober');
      }
      throw error;
    }
  };
}
