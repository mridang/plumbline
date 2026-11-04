/**
 * @packageDocumentation
 *
 * What a `plumbline` command asks for, once oclif has parsed its arguments and
 * flags (see `commands/`), and the mistake a command reports when what it was
 * asked cannot be done.
 */

/** How `plumbline scan` prints its findings. */
export type ScanFormat = 'text' | 'json' | 'html';

/** How `plumbline checks` prints the catalogue. */
export type ChecksFormat = 'text' | 'json';

/** The lowest severity that makes `plumbline scan` exit non-zero. */
export type FailOn = 'error' | 'warning' | 'none';

/** `plumbline scan <target>` and the options that shape it. */
export interface ScanCommand {
  kind: 'scan';
  /** The URL or bare domain as typed; `normalizeTarget` turns it into a URL. */
  target: string;
  format: ScanFormat;
  /** Bare hint ids to run; empty means every hint. */
  only: string[];
  /** Bare hint ids to leave out. */
  skip: string[];
  /** Groups whose hints to run; empty means every group. */
  groups: string[];
  failOn: FailOn;
  /** Where `--format html` writes its report files. */
  out: string;
  /** A Chrome or Chromium binary; the connector finds one when omitted. */
  browser?: string;
  /** Whether Chromium keeps its sandbox (`--no-sandbox` turns it off). */
  sandbox: boolean;
}

/** `plumbline checks`, listing the catalogue. */
export interface ChecksCommand {
  kind: 'checks';
  groups: string[];
  format: ChecksFormat;
}

/**
 * A mistake in how the command was invoked. The CLI prints its message with a
 * pointer to `--help` and exits with the usage status, rather than a stack.
 */
export class UsageError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

/** The report directory `--format html` writes to, as webhint's formatter does. */
export const DEFAULT_OUT = 'hint-report';

/** The formats `plumbline scan` prints. */
export const SCAN_FORMATS: readonly ScanFormat[] = ['text', 'json', 'html'];

/** The formats `plumbline checks` prints. */
export const CHECKS_FORMATS: readonly ChecksFormat[] = ['text', 'json'];

/** The severities `--fail-on` takes. */
export const FAIL_ON: readonly FailOn[] = ['error', 'warning', 'none'];
