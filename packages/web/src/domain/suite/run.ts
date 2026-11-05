/**
 * @packageDocumentation
 *
 * One server-side run of a site: the scanner container scans it, and the
 * outcomes of its checks become what the suite stores and reports.
 */

import { checksOf, skippedOf, type CheckResult } from '@/domain/suite/checks';
import type { ScanResult } from '@/domain/suite/scanner';

/** The outcome of one run. */
export interface SuiteRun {
  /** The address the page was finally served from. */
  readonly url: string;
  readonly status: number;
  /** SHA-256 of what the run found, to tell whether the next run found the same. */
  readonly hash: string;
  /** What the checks that ran found. */
  readonly checks: readonly CheckResult[];
  /** The ids of the checks that could not run, whose previous findings still stand. */
  readonly skipped: readonly string[];
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

/**
 * The run a scan came to. Throws when no check ran at all: a scan where
 * everything was skipped found nothing out, and must not read as a clean site
 * (it would close the issue of a site that has problems).
 */
export async function suiteRunOf(
  scan: Readonly<ScanResult>,
): Promise<SuiteRun> {
  const checks = checksOf(scan.outcomes);
  if (checks.length === 0) {
    throw new Error('The scanner ran no checks.');
  }
  const found = checks
    .toSorted((a, b) => (a.id < b.id ? -1 : 1))
    .map((check) => [check.id, check.findings]);
  return {
    url: scan.finalUrl,
    status: scan.status,
    hash: await sha256Hex(`${scan.status}\n${JSON.stringify(found)}`),
    checks,
    skipped: skippedOf(scan.outcomes),
  };
}
