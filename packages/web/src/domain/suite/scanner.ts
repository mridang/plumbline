/**
 * @packageDocumentation
 *
 * Talking to the scanner container from the server side: starting a scan,
 * reading the stream of lines it answers with (the same lines the page reads;
 * see `domain/scan/stream.ts` for the page's reader), and handing a
 * deployment to the container's Durable Object as a job that outlives the
 * request. A scan takes tens of seconds, far longer than a webhook delivery
 * may keep working after it has answered, so the delivery only leaves the job
 * behind and the Durable Object finishes it from an alarm.
 */

import { z } from 'zod';

import type { Deployment } from '@/domain/suite/deploy';

/** The part of the container's Durable Object namespace the server side uses. */
export interface ScannerNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

/** The scanner could not be reached, or the site could not be scanned. */
export class ScanFailed extends Error {
  public constructor(detail: string) {
    super(detail);
    this.name = 'ScanFailed';
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
 * Reads the scanner's stream to its end. Throws {@link ScanFailed} when the
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
      throw new ScanFailed('The scanner sent a line that is not JSON.');
    }
    const parsed = LineSchema.safeParse(json);
    if (!parsed.success) {
      return;
    }
    const event = parsed.data;
    if (event.type === 'unreachable') {
      throw new ScanFailed(event.detail);
    } else if (event.type === 'ready') {
      ready = { finalUrl: event.finalUrl, status: event.status };
    } else if (event.type === 'done') {
      outcomes.push(event.outcome);
      raw.push((json as { outcome: unknown }).outcome);
    } else {
      ended = true;
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    lines.forEach(take);
    if (done) {
      break;
    }
  }
  take(buffer);
  if (!ready || !ended) {
    throw new ScanFailed('The scan stopped before it finished.');
  }
  return { ...ready, outcomes, raw };
}

/** The scan of `url` as the container's stream; throws {@link ScanFailed} when it did not start. */
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
    throw new ScanFailed('The scanner did not answer.');
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

/** A scan of `url` through the container's Durable Object namespace. */
export function scanThrough(
  namespace: ScannerNamespace | undefined,
  url: string,
): Promise<ScanResult> {
  if (!namespace) {
    return Promise.reject(new ScanFailed('Scans are not available.'));
  }
  const stub = namespace.get(namespace.idFromName('main'));
  return scanWith((request) => stub.fetch(request), url);
}

/** What a deployment leaves for the container's Durable Object to finish. */
export interface SuiteJob {
  readonly installationId: number;
  readonly userId: number;
  readonly deployed: Deployment;
  /** The app's public origin, for the link in a check to its report. */
  readonly appUrl?: string;
  /** Check even a commit that was checked before (the rules changed). */
  readonly force?: boolean;
}

/** The path the Durable Object takes jobs on. */
export const JOBS_PATH = '/jobs';

/**
 * Leave `job` with the container's Durable Object, which keeps it until it has
 * run it, whatever happens to the request that brought it. Resolves once the
 * job is kept; the checks run afterwards.
 */
export async function enqueueJob(
  namespace: ScannerNamespace | undefined,
  job: SuiteJob,
): Promise<void> {
  if (!namespace) {
    throw new ScanFailed('Scans are not available.');
  }
  const stub = namespace.get(namespace.idFromName('main'));
  const answer = await stub.fetch(
    new Request(`https://scanner.internal${JOBS_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(job),
    }),
  );
  if (!answer.ok) {
    throw new ScanFailed('The scanner did not take the job.');
  }
}
