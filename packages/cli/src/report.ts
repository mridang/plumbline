import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FormatterOptions } from 'hint';
import { Severity, type Problem } from '@hint/utils-types';
import ExtraFormatter from '@mridang/webhint-formatter-plumbline';
import { hintCtors, type HintMeta, type ScanResult } from './scan.js';

/** One finding in the JSON report, flattened from a webhint `Problem`. */
export interface Finding {
  hintId: string;
  category: string;
  groups: string[];
  severity: string;
  message: string;
  resource: string;
  location?: { line: number; column: number };
  codeSnippet?: string;
  documentation?: Problem['documentation'];
}

/** How many findings there were at each severity, plus the total. */
export interface Summary {
  error: number;
  warning: number;
  hint: number;
  information: number;
  total: number;
}

/**
 * The JSON envelope the Docker server returns from `/scan`, and that a saved
 * report (the Docker image's mounted directory, `plumbline scan --out`) holds.
 */
export interface Report {
  url: string;
  scannedAt: string;
  scannerVersion: string;
  summary: Summary;
  findings: Finding[];
}

/** Looks up a hint's catalogue entry so a finding can carry its groups. */
function metaFor(hintId: string, hints: HintMeta[]): HintMeta | undefined {
  // Problems report the prefixed id (`extra/<id>`); the catalogue is bare.
  const bare = hintId.replace(/^extra\//, '');
  return hints.find((h) => h.id === bare);
}

/** Turns one webhint problem into a JSON finding. */
function toFinding(problem: Problem, hints: HintMeta[]): Finding {
  const meta = metaFor(problem.hintId, hints);
  return {
    hintId: problem.hintId,
    category: meta?.category ?? 'other',
    groups: meta?.groups ?? [],
    severity: Severity[problem.severity] ?? 'hint',
    message: problem.message,
    resource: problem.resource,
    location:
      problem.location && problem.location.line >= 0
        ? { line: problem.location.line, column: problem.location.column }
        : undefined,
    codeSnippet: problem.sourceCode || undefined,
    documentation: problem.documentation,
  };
}

/**
 * Builds the JSON report envelope from a scan result.
 *
 * @param url The scanned URL.
 * @param result What the scan found.
 * @param scannerVersion The version stamped on the report: the Docker image
 *   passes the release tag it was built with, the CLI its package version.
 * @returns The report envelope.
 */
export function buildReport(
  url: string,
  result: ScanResult,
  scannerVersion = 'dev',
): Report {
  const findings = result.problems.map((p) => toFinding(p, result.hints));
  const count = (name: string): number =>
    findings.filter((f) => f.severity === name).length;
  return {
    url,
    scannedAt: new Date().toISOString(),
    scannerVersion,
    summary: {
      error: count('error'),
      warning: count('warning'),
      hint: count('hint'),
      information: count('information'),
      total: findings.length,
    },
    findings,
  };
}

/**
 * Names the report file after the target, matching the HTML formatter so the
 * `.json` and `.html` reports for one scan sit side by side with one name.
 *
 * @param target The scanned URL.
 * @returns A bare file name (no directory, no extension).
 */
function slug(target: string): string {
  const name = target
    .replace(/:\/\//g, '-')
    .replace(/:/g, '-')
    .replace(/\./g, '-')
    .replace(/\//g, '-')
    .replace(/[?=]/g, '-query-')
    .replace(/-$/, '');
  return name || 'report';
}

/** Where a saved report's two files landed. */
export interface SavedReport {
  json: string;
  html: string;
}

/**
 * Writes the JSON report and the HTML report into a directory, so a scan run
 * with a host directory mounted into the container, or a CLI scan with
 * `--format html`, leaves both behind.
 *
 * @param url The scanned URL.
 * @param report The JSON report to write.
 * @param result The scan result, for the HTML formatter's hint resources.
 * @param directory The output directory (created if missing).
 * @returns The absolute paths of the two files written.
 */
export async function saveReport(
  url: string,
  report: Report,
  result: ScanResult,
  directory: string,
): Promise<SavedReport> {
  await mkdir(directory, { recursive: true });
  const base = slug(url);
  const jsonPath = path.join(directory, `${base}.json`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  // The formatter derives the same slug and writes `<directory>/<base>.html`.
  // Its `resources.hints` wants webhint's full hint constructor type; only
  // `meta.docs` is read, so the loose catalogue constructors are cast in.
  const options = {
    target: url,
    date: report.scannedAt,
    resources: { hints: hintCtors(result.hints.map((h) => h.id)) },
    output: directory,
  } as unknown as FormatterOptions;
  await new ExtraFormatter().format(result.problems, options);
  return { json: jsonPath, html: path.join(directory, `${base}.html`) };
}
