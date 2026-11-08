/**
 * @packageDocumentation
 *
 * The `ProbeScanner` Durable Object: the scanner of `ScannerContainer`, with the
 * checks run here instead of in the container. Every check is the hints package
 * running in this object; what a Worker cannot do itself (TLS handshakes with
 * chosen versions and ciphers, STARTTLS on mail servers, TCP connections to chosen
 * ports, HTTP exchanges whose headers must arrive exactly as the site sent them)
 * is asked of the probe, a small static program in the container this object owns
 * (`probe/README.md`). The container is a couple of megabytes and idles at a few
 * megabytes of memory, so it runs on the smallest instance type.
 *
 * It answers what `ScannerContainer` answers: `POST /run` streams one line of
 * JSON for each check (the page reads them), and `POST /jobs` runs a queued job
 * (see `domain/suite/queue.ts`), which asks for the same stream through `forward`.
 */

import { ProbeClient } from '@mridang/plumbline/dist/engine/probe/client.js';
import { runWorkerScan } from '@mridang/plumbline/dist/engine/probe/worker.js';

import { ScannerContainer } from '@/lib/cloudflare/scanner-container';

/** The media type of the stream a scan answers with. */
const NDJSON = 'application/x-ndjson; charset=utf-8';

/** Runs the checks of a scan here, and the probe in the container. */
export class ProbeScanner extends ScannerContainer {
  /** Send one request to the probe in the container, starting it when it is not running. */
  private async callProbe(
    path: string,
    body: string,
  ): Promise<{ status: number; text: string }> {
    const answer = await super.forward(
      new Request(`https://probe.internal${path}`, { method: 'POST', body }),
    );
    return { status: answer.status, text: await answer.text() };
  }

  /** Run the checks of the scan in the request and stream what they find. */
  private async run(request: Request): Promise<Response> {
    const body = (await request.json()) as { url?: unknown };
    if (typeof body.url !== 'string') {
      return new Response('The scan needs a url.', { status: 400 });
    }
    const { readable, writable } = new TransformStream<
      Uint8Array,
      Uint8Array
    >();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const client = new ProbeClient((path, text) => this.callProbe(path, text));
    void runWorkerScan(
      client,
      body.url,
      (event) => {
        void writer.write(encoder.encode(`${JSON.stringify(event)}\n`));
      },
      {
        diagnose: (error) =>
          console.error('the page of a scan could not be loaded', error),
      },
    ).then(
      () => writer.close(),
      // The stream breaks, so whoever reads it knows the scan did not finish and tries again.
      (error: unknown) => writer.abort(error),
    );
    return new Response(readable, {
      headers: { 'content-type': NDJSON, 'cache-control': 'no-store' },
    });
  }

  /** Run a scan here; anything else goes to the container's probe. */
  protected override async forward(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/run') {
      return this.run(request);
    }
    return super.forward(request);
  }
}
