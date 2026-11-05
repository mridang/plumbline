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
 * It also runs the checks a GitHub deployment starts. A scan takes tens of
 * seconds, longer than a webhook delivery may keep working after it has
 * answered, so the delivery leaves a job here (`POST /jobs`) and this object
 * finishes it from an alarm: the job is kept in its storage until it has run,
 * so it survives the request, a restart, and the container's start-up time.
 */

import { DurableObject } from 'cloudflare:workers';

import { createDatabase } from '@/domain/db/client';
import { readGitHubConfig } from '@/domain/github/config';
import { createLive } from '@/domain/live/live';
import { handleDeployment } from '@/domain/suite/github-run';
import { readLimits, scanLimits } from '@/domain/suite/limits';
import { suiteRunOf, type SuiteRun } from '@/domain/suite/run';
import { JOBS_PATH, scanWith, type SuiteJob } from '@/domain/suite/scanner';

/** The port the scanner listens on. */
const PORT = 8080;

/** How long the container may be idle before it stops, in milliseconds. */
export const IDLE_MS = 120_000;

/** How long to wait for a starting container to answer, in milliseconds. */
export const START_TIMEOUT_MS = 60_000;

/** The pause between attempts to reach a starting container, in milliseconds. */
const RETRY_MS = 250;

/** The storage key prefix of a job waiting to run. */
const JOB_PREFIX = 'job:';

/** Starts the scanner on demand, forwards requests to it and runs the jobs left with it. */
export class ScannerContainer extends DurableObject<CloudflareEnv> {
  /** Keep the job in the request and make sure an alarm will run it. */
  private async keep(request: Request): Promise<Response> {
    let job: SuiteJob;
    try {
      job = (await request.json()) as SuiteJob;
    } catch {
      return new Response('The job is not JSON.', { status: 400 });
    }
    await this.ctx.storage.put(`${JOB_PREFIX}${crypto.randomUUID()}`, job);
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now());
    }
    return new Response(null, { status: 202 });
  }

  /** Scan `url` in the container and say what the run found. */
  private async scan(url: string): Promise<SuiteRun> {
    const scan = await scanWith((request) => this.forward(request), url);
    return suiteRunOf(scan);
  }

  /** Run one job: the checks of a deployment, reported on GitHub. */
  private async perform(job: Readonly<SuiteJob>): Promise<void> {
    const config = readGitHubConfig(this.env);
    if (!config) {
      console.error('suite job dropped: GitHub is not set up');
      return;
    }
    const db = createDatabase(this.env.DB);
    await handleDeployment(
      db,
      config,
      job.installationId,
      job.userId,
      job.deployed,
      {
        limits: scanLimits(readLimits(this.env)),
        live: createLive(db, this.env),
        run: (url) => this.scan(url),
        ...(job.appUrl ? { appUrl: job.appUrl } : {}),
        ...(job.force ? { force: true } : {}),
      },
    );
  }

  /**
   * Run the jobs that are waiting, one after another, and forget each when it
   * is done, however it went (a failure is logged; it must not run again for
   * ever). A job that arrives meanwhile sets the alarm again.
   */
  override async alarm(): Promise<void> {
    const waiting = await this.ctx.storage.list<SuiteJob>({
      prefix: JOB_PREFIX,
    });
    for (const [key, job] of waiting) {
      try {
        await this.perform(job);
      } catch (error) {
        console.error('suite job failed', job.deployed.repo, error);
      }
      await this.ctx.storage.delete(key);
    }
    const more = await this.ctx.storage.list({ prefix: JOB_PREFIX, limit: 1 });
    if (more.size > 0) {
      await this.ctx.storage.setAlarm(Date.now());
    }
  }

  /** Answer a job, or forward `request` to the scanner. */
  override async fetch(request: Request): Promise<Response> {
    if (
      request.method === 'POST' &&
      new URL(request.url).pathname === JOBS_PATH
    ) {
      return this.keep(request);
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
