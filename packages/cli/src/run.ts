/**
 * @packageDocumentation
 *
 * What the `plumbline` commands do once their arguments are parsed: list the
 * checks, or scan a site and print what it found. Each returns the exit status
 * instead of exiting, and takes where to write and what to scan with, so the
 * oclif commands stay thin and this can be tested without a browser.
 */

import path from 'node:path';
import type { ChecksCommand, ScanCommand } from './options.js';
import { findBrowser } from './browser.js';
import { EXIT, exitCodeFor } from './exit-code.js';
import {
  formatChecks,
  formatFindings,
  summaryLine,
  toJsonChecks,
  toJsonFindings,
} from './render.js';
import { buildReport, saveReport } from './report.js';
import {
  hintCatalogue,
  scan as realScan,
  type HintMeta,
  type ScanOptions,
  type ScanResult,
} from './scan.js';
import { filterByGroups, selectHints } from './select.js';
import { normalizeTarget } from './target.js';
import { packageVersion } from './version.js';

/** Where the CLI writes: stdout for results, stderr for progress and errors. */
export interface Io {
  stdout(text: string): void;
  stderr(text: string): void;
}

/**
 * What `main` depends on, each with a real default. Tests replace the scan so
 * the command layer can be checked without launching a browser.
 */
export interface Dependencies {
  scan?: (url: string, options?: ScanOptions) => Promise<ScanResult>;
  catalogue?: () => HintMeta[];
  version?: string;
  /** Finds a browser when `--browser` is not given (see `findBrowser`). */
  findBrowser?: () => string | undefined;
}

/** Prints the catalogue, narrowed to the requested groups. */
export function runChecks(
  command: ChecksCommand,
  io: Io,
  catalogue: readonly HintMeta[],
): number {
  const checks = filterByGroups(catalogue, command.groups, command);
  io.stdout(
    command.format === 'json'
      ? `${JSON.stringify(toJsonChecks(checks), null, 2)}\n`
      : formatChecks(checks),
  );
  return EXIT.ok;
}

/**
 * Scans the target with the selected hints, prints the findings in the chosen
 * format and returns the exit status `--fail-on` calls for.
 */
export async function runScan(
  command: ScanCommand,
  io: Io,
  catalogue: readonly HintMeta[],
  deps: Required<Dependencies>,
): Promise<number> {
  const url = normalizeTarget(command.target);
  const ids = selectHints(catalogue, command);
  // Progress goes to stderr so `--format json` output can be piped as is.
  io.stderr(
    `Scanning ${url} with ${ids.length} check${ids.length === 1 ? '' : 's'}…\n`,
  );

  let result: ScanResult;
  try {
    result = await deps.scan(url, {
      hints: ids,
      executablePath: command.browser ?? deps.findBrowser(),
      // Keep Chromium's sandbox unless asked: the CLI runs on a developer's
      // own machine, where the sandbox works and guards against the page.
      browserArgs: command.sandbox
        ? []
        : ['--no-sandbox', '--disable-dev-shm-usage'],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    io.stderr(
      `plumbline: the scan of ${url} failed: ${detail}\n` +
        'A Chrome or Chromium install is needed; point --browser at one if it ' +
        'is not found, and add --no-sandbox when running as root or in a container.\n',
    );
    return EXIT.failed;
  }

  const report = buildReport(url, result, deps.version);
  if (command.format === 'json') {
    io.stdout(`${JSON.stringify(toJsonFindings(report), null, 2)}\n`);
  } else if (command.format === 'html') {
    const saved = await saveReport(url, report, result, command.out);
    io.stdout(
      `${summaryLine(report, result.hints.length)}\n` +
        `Wrote ${path.resolve(saved.html)}\n` +
        `Wrote ${path.resolve(saved.json)}\n`,
    );
  } else {
    io.stdout(formatFindings(report, result.hints));
  }
  return exitCodeFor(report.findings, command.failOn);
}

/** The real dependencies, with any replacements a caller gives. */
export function resolveDependencies(
  dependencies: Dependencies = {},
): Required<Dependencies> {
  return {
    scan: dependencies.scan ?? realScan,
    catalogue: dependencies.catalogue ?? hintCatalogue,
    version: dependencies.version ?? packageVersion(),
    findBrowser: dependencies.findBrowser ?? (() => findBrowser()),
  };
}
