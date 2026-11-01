/**
 * @packageDocumentation
 *
 * One server-side run: fetch the page once, read it once, run the checks. A
 * single request and a single streaming pass keep the run inside the Workers
 * Free plan (50 subrequests, 10 ms of CPU a request); the network wait does
 * not count as CPU.
 */

import { extractFacts } from '@/domain/suite/facts';
import { runChecks, type CheckResult } from '@/domain/suite/checks';

/** How long to wait for the site, in milliseconds. */
const TIMEOUT_MS = 15_000;

/** The outcome of one run. */
export interface SuiteRun {
  url: string;
  status: number;
  checks: CheckResult[];
}

/** The part of `fetch` a run uses, so tests can pass their own. */
export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** Fetches `url` and runs the server-side checks; throws when the site cannot be reached. */
export async function runSuite(
  url: string,
  fetcher: Fetcher = fetch,
): Promise<SuiteRun> {
  const started = Date.now();
  const response = await fetcher(url, {
    redirect: 'follow',
    headers: { accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const responseMs = Date.now() - started;
  const html = await response.text();
  const page = {
    url: response.url || url,
    status: response.status,
    responseMs,
    html,
    bytes: new Blob([html]).size,
  };
  return {
    url: page.url,
    status: page.status,
    checks: runChecks(page, await extractFacts(html)),
  };
}
