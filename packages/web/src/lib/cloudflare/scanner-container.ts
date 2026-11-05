/**
 * @packageDocumentation
 *
 * The `ScannerContainer` Durable Object: the Worker's handle on the scanner
 * (the `mridang/plumbline` image without a browser: Node, the hints package and
 * the engine that runs every check). It starts the container when a request
 * comes, waits until it answers, passes the request on and hands the answer
 * back as a stream, so the page sees each check finish as it does. The
 * container stops after a few idle minutes, so it costs nothing between scans.
 * It is never reachable from outside: only the Worker has the binding, and it
 * only forwards scans it has checked (see `domain/scan/run.ts`).
 */

import { DurableObject } from 'cloudflare:workers';

/** The port the scanner listens on. */
const PORT = 8080;

/** How long the container may be idle before it stops, in milliseconds. */
export const IDLE_MS = 120_000;

/** How long to wait for a starting container to answer, in milliseconds. */
export const START_TIMEOUT_MS = 60_000;

/** The pause between attempts to reach a starting container, in milliseconds. */
const RETRY_MS = 250;

/** Starts the scanner on demand and forwards requests to it. */
export class ScannerContainer extends DurableObject<CloudflareEnv> {
  /** Forward `request` to the scanner, starting it first when it is not running. */
  override async fetch(request: Request): Promise<Response> {
    const container = this.ctx.container;
    if (!container) {
      return new Response('No container is bound.', { status: 503 });
    }
    if (!container.running) {
      container.start({ enableInternet: true });
    }
    // Every request renews the idle time, so a scan that streams for a while
    // is never cut short by the timeout set when the container started.
    await container.setInactivityTimeout(IDLE_MS);
    const port = container.getTcpPort(PORT);
    const deadline = Date.now() + START_TIMEOUT_MS;
    for (;;) {
      try {
        const health = await port.fetch('http://scanner/healthz');
        if (health.ok) {
          break;
        }
      } catch {
        // Not listening yet.
      }
      if (Date.now() > deadline) {
        return new Response('The scanner did not start.', { status: 503 });
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    }
    const url = new URL(request.url);
    // The answer is returned as it is, so its body streams to the caller; the
    // request's signal stops the scan when the caller goes away.
    return port.fetch(`http://scanner${url.pathname}`, {
      method: request.method,
      headers: request.headers,
      body: request.method === 'GET' ? undefined : request.body,
      signal: request.signal,
    });
  }
}
