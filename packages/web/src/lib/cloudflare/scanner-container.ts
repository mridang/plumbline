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
 *
 * It also runs the checks of one queued job (`POST /jobs`; see
 * `domain/suite/queue.ts`). The scan queue's consumer gives each job a Durable
 * Object name of its own, so each job gets a container of its own and jobs run
 * at the same time; the request lives until the job is done and answers 200,
 * or 500 so the queue tries again. The container is told to stop soon after
 * its job, because the containers that may run at once are limited
 * (`max_instances` in `wrangler.jsonc`).
 */

import { DurableObject } from 'cloudflare:workers';

import { createDatabase } from '@/domain/db/client';
import { isRepoDisabled } from '@/domain/db/disabled';
import { readGitHubConfig } from '@/domain/github/config';
import { createLive } from '@/domain/live/live';
import { checkSite } from '@/domain/suite/deploy';
import { handleDeployment } from '@/domain/suite/github-run';
import { readLimits, scanLimits } from '@/domain/suite/limits';
import { enqueueScan } from '@/domain/suite/queue';
import { suiteRunOf, type SuiteRun } from '@/domain/suite/run';
import {
  JOBS_PATH,
  SiteUnreachable,
  scanWith,
  type ScanJob,
  type SuiteJob,
} from '@/domain/suite/scanner';

/** The port the scanner listens on. */
const PORT = 8080;

/** How long the container may be idle before it stops, in milliseconds. */
export const IDLE_MS = 120_000;

/** How long to wait for a starting container to answer, in milliseconds. */
export const START_TIMEOUT_MS = 60_000;

/** The pause between attempts to reach a starting container, in milliseconds. */
const RETRY_MS = 250;

/** How long a container that has finished its job may stay up, in milliseconds. */
export const AFTER_JOB_IDLE_MS = 5_000;

/** The storage key prefix of the jobs the single-object version of this class kept. */
const LEGACY_JOB_PREFIX = 'job:';

/** Starts the scanner on demand, forwards requests to it and runs the job it is given. */
export class ScannerContainer extends DurableObject<CloudflareEnv> {
  /** Scan `url` in the container and say what the run found. */
  private async scan(url: string): Promise<SuiteRun> {
    const scan = await scanWith((request) => this.forward(request), url);
    return suiteRunOf(scan);
  }

  /**
   * Run one job to its end. Throws when the scanner itself failed (it was
   * full, it restarted, its stream broke), so that the queue tries the job
   * again; a site that does not answer is not a failure, it is a result.
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

  /**
   * Jobs the earlier version of this class kept in its own storage (it was one
   * object for every job) are handed to the queue, so none is lost by the
   * change; after that this has nothing to do.
   */
  override async alarm(): Promise<void> {
    const left = await this.ctx.storage.list<SuiteJob>({
      prefix: LEGACY_JOB_PREFIX,
    });
    const queue = this.env.SCAN_QUEUE;
    const db = createDatabase(this.env.DB);
    for (const [key, job] of left) {
      await enqueueScan(db, queue, { kind: 'deployment', ...job });
      await this.ctx.storage.delete(key);
    }
  }

  /** Answer a job, or forward `request` to the scanner. */
  override async fetch(request: Request): Promise<Response> {
    if (
      request.method === 'POST' &&
      new URL(request.url).pathname === JOBS_PATH
    ) {
      return this.runJob(request);
    }
    return this.forward(request);
  }

  /** Forward `request` to the scanner, starting it first when it is not running. */
  private async forward(request: Request): Promise<Response> {
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
