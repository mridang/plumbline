/**
 * @packageDocumentation
 *
 * The `ProbeContainer` Durable Object: the Worker's handle on the TLS prober
 * (`probe/`, one static C binary on OpenSSL, about a megabyte). It starts the
 * container when a request comes, waits until it answers, passes the request
 * on, and lets the container stop after a short idle time, so it costs
 * nothing between scans. It is never reachable from outside: only the Worker
 * has the binding, and it only forwards probes it has validated.
 */

import { DurableObject } from 'cloudflare:workers';

/** The port the prober listens on. */
const PORT = 8080;

/** How long the container may be idle before it stops, in milliseconds. */
export const IDLE_MS = 15_000;

/** How long to wait for a starting container to answer, in milliseconds. */
export const START_TIMEOUT_MS = 10_000;

/** The pause between attempts to reach a starting container, in milliseconds. */
const RETRY_MS = 150;

/** Starts the prober on demand and forwards requests to it. */
export class ProbeContainer extends DurableObject<CloudflareEnv> {
  /** Forward `request` to the prober, starting it first when it is not running. */
  override async fetch(request: Request): Promise<Response> {
    const container = this.ctx.container;
    if (!container) {
      return new Response('No container is bound.', { status: 503 });
    }
    if (!container.running) {
      container.start({ enableInternet: true });
      await container.setInactivityTimeout(IDLE_MS);
    }
    const port = container.getTcpPort(PORT);
    const deadline = Date.now() + START_TIMEOUT_MS;
    for (;;) {
      try {
        const health = await port.fetch('http://probe/healthz');
        if (health.ok) {
          break;
        }
      } catch {
        // Not listening yet.
      }
      if (Date.now() > deadline) {
        return new Response('The prober did not start.', { status: 503 });
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    }
    const url = new URL(request.url);
    return port.fetch(`http://probe${url.pathname}`, {
      method: request.method,
      headers: request.headers,
      body: request.method === 'GET' ? undefined : request.body,
    });
  }
}
