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
  /** SHA-256 of the status and body that were read. */
  hash: string;
  /** What the checks found; null when the page is the same as the one the run was told about. */
  checks: CheckResult[] | null;
}

/** The SHA-256 of `text` as hex, computed natively by the runtime. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** The part of `fetch` a run uses, so tests can pass their own. */
export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Fetches `url` and runs the server-side checks; throws when the site cannot
 * be reached. When the response hashes to `previousHash` nothing is read or
 * checked (`checks` is null): hashing is native and cheap, reading the page is
 * not.
 */
export async function runSuite(
  url: string,
  previousHash: string | null = null,
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
  const hash = await sha256Hex(`${response.status}\n${html}`);
  if (hash === previousHash) {
    return {
      url: response.url || url,
      status: response.status,
      hash,
      checks: null,
    };
  }
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
    hash,
    checks: runChecks(page, await extractFacts(html)),
  };
}
