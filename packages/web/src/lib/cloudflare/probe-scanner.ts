/**
 * @packageDocumentation
 *
 * The `ProbeScanner` Durable Object: where every scan runs. The checks are the
 * hints package running in this object; what a Worker cannot do itself (TLS
 * handshakes with chosen versions and ciphers, STARTTLS on mail servers, TCP
 * connections to chosen ports, HTTP exchanges whose headers must arrive exactly as
 * the site sent them) is asked of the probe, a small static program in the
 * container this object owns (`probe/README.md`). The container is a few megabytes
 * and idles at a few megabytes of memory. It stops after a few idle minutes, so it
 * costs nothing between scans, and it is never reachable from outside: only the
 * Worker has the binding.
 *
 * `POST /run` streams one line of JSON for each check as it finishes (the page
 * reads them). `POST /jobs` runs the checks of one queued job (see
 * `domain/suite/queue.ts`): the scan queue's consumer gives each job a Durable
 * Object name of its own, so each job gets a container of its own and jobs run at
 * the same time; the request lives until the job is done and answers 200, or 500
 * so the queue tries again. The container is told to stop soon after its job,
 * because the containers that may run at once are limited (`max_instances` in
 * `wrangler.jsonc`).
 */

import { ProbeClient } from '@mridang/plumbline/dist/engine/probe/client.js';
import { runWorkerScan } from '@mridang/plumbline/dist/engine/probe/worker.js';
import { DurableObject } from 'cloudflare:workers';

import { createDatabase } from '@/domain/db/client';
import { isRepoDisabled } from '@/domain/db/disabled';
import { readGitHubConfig } from '@/domain/github/config';
import { createLive } from '@/domain/live/live';
import { checkSite } from '@/domain/suite/deploy';
import { handleDeployment } from '@/domain/suite/github-run';
import { readLimits, scanLimits } from '@/domain/suite/limits';
import { suiteRunOf, type SuiteRun } from '@/domain/suite/run';
import {
  JOBS_PATH,
  SiteUnreachable,
  collectScan,
  type ScanJob,
} from '@/domain/suite/scanner';

/** The port the probe listens on. */
const PORT = 8080;

/** How long the container may be idle before it stops, in milliseconds. */
export const IDLE_MS = 120_000;

/** How long to wait for a starting container to answer, in milliseconds. */
export const START_TIMEOUT_MS = 60_000;

/** The pause between attempts to reach a starting container, in milliseconds. */
const RETRY_MS = 250;

/** How long a container that has finished its job may stay up, in milliseconds. */
export const AFTER_JOB_IDLE_MS = 5_000;

/** The media type of the stream a scan answers with. */
const NDJSON = 'application/x-ndjson; charset=utf-8';

/** Runs the checks of a scan here, and the probe in the container. */
export class ProbeScanner extends DurableObject<CloudflareEnv> {
  /** Send one request to the probe in the container, starting it when it is not running. */
  private async callProbe(
    path: string,
    body: string,
  ): Promise<{ status: number; text: string }> {
    const answer = await this.forward(
      new Request(`https://probe.internal${path}`, { method: 'POST', body }),
    );
    return { status: answer.status, text: await answer.text() };
  }

  /**
   * Run the checks of the scan of `url` and stream what they find, one line of
   * JSON for each. The stream breaks when the probe is not there to ask, so
   * whoever reads it knows the scan did not finish and tries again.
   */
  private startScan(url: string): ReadableStream<Uint8Array> {
    const { readable, writable } = new TransformStream<
      Uint8Array,
      Uint8Array
    >();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const client = new ProbeClient((path, text) => this.callProbe(path, text));
    void runWorkerScan(
      client,
      url,
      (event) => {
        void writer.write(encoder.encode(`${JSON.stringify(event)}\n`));
      },
      {
        diagnose: (error) =>
          console.error('the page of a scan could not be loaded', error),
      },
    ).then(
      () => writer.close(),
      (error: unknown) => writer.abort(error),
    );
    return readable;
  }

  /** Answer `POST /run`: the stream of a scan. */
  private async run(request: Request): Promise<Response> {
    const body = (await request.json()) as { url?: unknown };
    if (typeof body.url !== 'string') {
      return new Response('The scan needs a url.', { status: 400 });
    }
    return new Response(this.startScan(body.url), {
      headers: { 'content-type': NDJSON, 'cache-control': 'no-store' },
    });
  }

  /** Scan `url` and say what the run found. */
  private async scan(url: string): Promise<SuiteRun> {
    return suiteRunOf(await collectScan(this.startScan(url)));
  }

  /**
   * Run one job to its end. Throws when the scanner itself failed (the probe
   * was busy or down, the stream broke), so that the queue tries the job again;
   * a site that does not answer is not a failure, it is a result.
   */
  private async perform(job: Readonly<ScanJob>): Promise<void> {
    const db = createDatabase(this.env.DB);
    let trouble: unknown;
    const run = async (url: string): Promise<SuiteRun> => {
      try {
        return await this.scan(url);
      } catch (error) {
        if (!(error instanceof SiteUnreachable)) {
          trouble = error;
        }
        throw error;
      }
    };
    const limits = scanLimits(readLimits(this.env));
    const live = createLive(db, this.env);
    if (job.kind === 'recheck') {
      if (!(await isRepoDisabled(db, job.repo))) {
        await checkSite(
          db,
          job.userId,
          { host: job.host, repo: job.repo, sha: null },
          { kind: 'scheduled', limits, live, run },
        );
      }
    } else {
      const config = readGitHubConfig(this.env);
      if (!config) {
        console.error('suite job dropped: GitHub is not set up');
        return;
      }
      await handleDeployment(
        db,
        config,
        job.installationId,
        job.userId,
        job.deployed,
        {
          limits,
          live,
          run,
          ...(job.appUrl ? { appUrl: job.appUrl } : {}),
          ...(job.force ? { force: true } : {}),
        },
      );
    }
    if (trouble) {
      throw trouble;
    }
  }

  /** Run the job in the request and answer when it is done. */
  private async runJob(request: Request): Promise<Response> {
    let job: ScanJob;
    try {
      job = (await request.json()) as ScanJob;
    } catch {
      return new Response('The job is not JSON.', { status: 400 });
    }
    try {
      await this.perform(job);
      return new Response(null, { status: 200 });
    } catch (error) {
      console.error('scan job failed in the scanner', error);
      return new Response(
        error instanceof Error ? error.message : 'The job failed.',
        { status: 500 },
      );
    } finally {
      // Free the container's place for the next job.
      await this.ctx.container
        ?.setInactivityTimeout(AFTER_JOB_IDLE_MS)
        .catch(() => undefined);
    }
  }

  /** Answer a job or a scan; anything else goes to the probe in the container. */
  override async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (request.method === 'POST' && path === JOBS_PATH) {
      return this.runJob(request);
    }
    if (request.method === 'POST' && path === '/run') {
      return this.run(request);
    }
    return this.forward(request);
  }

  /** Forward `request` to the probe, starting the container first when it is not running. */
  private async forward(request: Request): Promise<Response> {
    const container = this.ctx.container;
    if (!container) {
      return new Response('No container is bound.', { status: 503 });
    }
    if (!container.running) {
      container.start({ enableInternet: true });
    }
    // Every request renews the idle time, so a scan that goes on for a while
    // is never cut short by the timeout set when the container started.
    await container.setInactivityTimeout(IDLE_MS);
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
        return new Response('The probe did not start.', { status: 503 });
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    }
    const url = new URL(request.url);
    return port.fetch(`http://probe${url.pathname}`, {
      method: request.method,
      headers: request.headers,
      body: request.method === 'GET' ? undefined : request.body,
      signal: request.signal,
    });
  }
}
