import { parseArgs } from 'node:util';

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

/** Everything the command line can ask for. */
export type Command =
  ScanCommand | ChecksCommand | { kind: 'help' } | { kind: 'version' };

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

/**
 * Every option the CLI understands. Options that only make sense for one
 * command are checked per command after parsing, so a typo such as
 * `checks --only csp` is refused instead of silently ignored.
 */
const OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  format: { type: 'string', short: 'f' },
  only: { type: 'string', multiple: true },
  skip: { type: 'string', multiple: true },
  group: { type: 'string', short: 'g', multiple: true },
  'fail-on': { type: 'string' },
  out: { type: 'string', short: 'o' },
  browser: { type: 'string' },
  'no-sandbox': { type: 'boolean' },
} as const;

/** The options `plumbline checks` accepts besides `--help`. */
const CHECKS_OPTIONS = new Set(['group', 'format']);

/**
 * Splits repeatable, comma-separated list options (`--only a,b --only c`)
 * into one trimmed list, dropping empty entries.
 */
function list(values: readonly string[] | undefined): string[] {
  return (values ?? [])
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/** Reads a string option that must be one of a fixed set of values. */
function oneOf<T extends string>(
  name: string,
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === undefined) {
    return fallback;
  }
  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new UsageError(
    `--${name} must be one of ${allowed.join(', ')} (got "${value}")`,
  );
}

/**
 * Parses the command line (without the `node` and script entries) into a
 * command. `--help` and `--version` win over everything else, so they work
 * even next to a mistake.
 *
 * @param argv The arguments after the program name.
 * @returns The command to run.
 * @throws UsageError when the arguments do not form a valid command.
 */
export function parseCommand(argv: readonly string[]): Command {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      options: OPTIONS,
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    // parseArgs throws a TypeError with a readable message for an unknown
    // option or a missing value; surface it as a usage mistake.
    throw new UsageError(
      error instanceof Error ? error.message : String(error),
    );
  }
  const { values, positionals } = parsed;

  if (values.help) {
    return { kind: 'help' };
  }
  if (values.version) {
    return { kind: 'version' };
  }

  const [command, ...rest] = positionals;
  if (command === undefined) {
    return { kind: 'help' };
  }

  if (command === 'checks') {
    if (rest.length > 0) {
      throw new UsageError(`checks takes no arguments (got "${rest[0]}")`);
    }
    const stray = Object.keys(values).find((key) => !CHECKS_OPTIONS.has(key));
    if (stray) {
      throw new UsageError(`--${stray} only applies to scan`);
    }
    return {
      kind: 'checks',
      groups: list(values.group),
      format: oneOf('format', values.format, ['text', 'json'], 'text'),
    };
  }

  if (command === 'scan') {
    const [target, ...extra] = rest;
    if (target === undefined) {
      throw new UsageError('scan needs a URL or a domain to scan');
    }
    if (extra.length > 0) {
      throw new UsageError(`scan takes one target (got also "${extra[0]}")`);
    }
    return {
      kind: 'scan',
      target,
      format: oneOf('format', values.format, ['text', 'json', 'html'], 'text'),
      only: list(values.only),
      skip: list(values.skip),
      groups: list(values.group),
      failOn: oneOf(
        'fail-on',
        values['fail-on'],
        ['error', 'warning', 'none'],
        'error',
      ),
      out: values.out ?? DEFAULT_OUT,
      browser: values.browser,
      sandbox: !values['no-sandbox'],
    };
  }

  throw new UsageError(`unknown command "${command}"`);
}
