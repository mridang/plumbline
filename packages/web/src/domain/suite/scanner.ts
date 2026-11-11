/**
 * @packageDocumentation
 *
 * Talking to the scanner container from the server side: starting a scan,
 * reading the stream of lines it answers with (the same lines the page reads;
 * see `domain/scan/stream.ts` for the page's reader), and running the jobs the
 * scan queue hands out (see `domain/suite/queue.ts`) in a scanner Durable
 * Object of their own.
 */

import { z } from 'zod';

import type { Deployment } from '@/domain/suite/deploy';

/** The part of the container's Durable Object namespace the server side uses. */
export interface ScannerNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

/** The scanner could not be reached, or the site could not be scanned. */
export class ScanFailedError extends Error {
  public constructor(detail: string) {
    super(detail);
    this.name = 'ScanFailedError';
  }
}

/** The scanner ran, and the site did not answer it. Anything else that goes wrong is the scanner's trouble, not the site's. */
export class SiteUnreachableError extends ScanFailedError {
  public constructor(detail: string) {
    super(detail);
    this.name = 'SiteUnreachableError';
  }
}

/** One check's outcome, as much of it as the suite reads. */
const OutcomeSchema = z.object({
  id: z.string(),
  status: z.enum(['passed', 'warned', 'failed', 'skipped']),
  findings: z.array(
    z.object({
      level: z.enum(['error', 'warning', 'hint', 'information']),
      message: z.string(),
    }),
  ),
});

/** One check's outcome. */
export type ScanOutcome = z.infer<typeof OutcomeSchema>;

/** The lines of the scanner's stream the suite reads; others are ignored. */
const LineSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ready'),
    finalUrl: z.string(),
    status: z.number(),
  }),
  z.object({ type: z.literal('done'), outcome: OutcomeSchema }),
  z.object({ type: z.literal('unreachable'), detail: z.string() }),
  z.object({ type: z.literal('end') }),
]);

/** What a scan came to. */
export interface ScanResult {
  /** The address the page was finally served from, after redirects. */
  readonly finalUrl: string;
  /** The page's HTTP status. */
  readonly status: number;
  readonly outcomes: readonly ScanOutcome[];
  /** The same outcomes as the scanner sent them, with every field, to keep as a report. */
  readonly raw: readonly unknown[];
}

/**
 * Reads the scanner's stream to its end. Throws {@link ScanFailedError} when the
 * site could not be reached, when a line is not JSON, or when the stream stops
 * before its last line (the scanner went away part-way, so what was read is
 * not the whole scan).
 */
export async function collectScan(
  body: ReadableStream<Uint8Array>,
): Promise<ScanResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const outcomes: ScanOutcome[] = [];
  const raw: unknown[] = [];
  let ready: { finalUrl: string; status: number } | undefined;
  let ended = false;
  let buffer = '';
  const take = (line: string): void => {
    if (line.trim() === '') {
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      throw new ScanFailedError('The scanner sent a line that is not JSON.');
    }
    const parsed = LineSchema.safeParse(json);
    if (!parsed.success) {
      return;
    }
    const event = parsed.data;
    switch (event.type) {
      case 'unreachable': {
        throw new SiteUnreachableError(event.detail);
      }
      case 'ready': {
        ready = { finalUrl: event.finalUrl, status: event.status };

        break;
      }
      case 'done': {
        outcomes.push(event.outcome);
        raw.push((json as { outcome: unknown }).outcome);

        break;
      }
      default: {
        ended = true;
      }
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    lines.forEach((line) => take(line));
    if (done) {
      break;
    }
  }
  take(buffer);
  if (!ready || !ended) {
    throw new ScanFailedError('The scan stopped before it finished.');
  }
  return { ...ready, outcomes, raw };
}

/** The scan of `url` as the container's stream; throws {@link ScanFailedError} when it did not start. */
async function startScan(
  send: (request: Request) => Promise<Response>,
  url: string,
): Promise<ReadableStream<Uint8Array>> {
  const answer = await send(
    new Request('https://scanner.internal/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    }),
  );
  if (!answer.ok || !answer.body) {
    throw new ScanFailedError('The scanner did not answer.');
  }
  return answer.body;
}

/** A scan of `url` through the container; `send` delivers the request to it. */
export async function scanWith(
  send: (request: Request) => Promise<Response>,
  url: string,
): Promise<ScanResult> {
  return collectScan(await startScan(send, url));
}

/** What a deployment leaves for a scanner Durable Object to finish. */
export interface SuiteJob {
  readonly installationId: number;
  readonly userId: number;
  readonly deployed: Deployment;
  /** The app's public origin, for the link in a check to its report. */
  readonly appUrl?: string;
  /** Check even a commit that was checked before (the rules changed). */
  readonly force?: boolean;
}

/** One unit of work for the scan queue. */
export type ScanJob =
  | ({ readonly kind: 'deployment' } & SuiteJob)
  | {
      /** The scheduled re-check of one site found through GitHub. */
      readonly kind: 'recheck';
      readonly userId: number;
      readonly host: string;
      readonly repo: string;
    };

/**
 * What a job is about: jobs with the same key are the same work, so only the
 * newest is run (see `domain/db/pending-scans.ts`). A deployment of a live site
 * is the whole repository, a preview is its address, a change of rules is kept
 * apart from deployments so that neither replaces the other.
 */
export function keyOf(job: Readonly<ScanJob>): string {
  if (job.kind === 'recheck') {
    return `site:${job.userId}:${job.host}`;
  }
  const { repo, environment, url } = job.deployed;
  if (job.force) {
    return `config:${repo}`;
  }
  return environment === 'production'
    ? `deploy:${repo}`
    : `preview:${repo}:${url ?? ''}`;
}

/** The path a scanner Durable Object takes a job on; it answers once the job has run. */
export const JOBS_PATH = '/jobs';

/**
 * Run `job` in the scanner Durable Object called `name` (each name has its own
 * container, so jobs of different names run at the same time) and resolve when
 * it is done. Throws {@link ScanFailedError} when the object could not run it, so
 * the caller can try again.
 */
export async function runJobThrough(
  namespace: ScannerNamespace | undefined,
  name: string,
  job: Readonly<ScanJob>,
): Promise<void> {
  if (!namespace) {
    throw new ScanFailedError('Scans are not available.');
  }
  const stub = namespace.get(namespace.idFromName(name));
  const answer = await stub.fetch(
    new Request(`https://scanner.internal${JOBS_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(job),
    }),
  );
  if (!answer.ok) {
    const body = await answer.text();
    throw new ScanFailedError(
      `The scanner did not run the job (${answer.status}): ${body.slice(0, 200)}`,
    );
  }
}
