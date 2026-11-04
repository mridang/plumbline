import { fileURLToPath } from 'node:url';

import type Checks from '../../src/commands/checks.js';
import type Scan from '../../src/commands/scan.js';
import type { Dependencies } from '../../src/run.js';

/** The CLI package, whose `package.json` holds the oclif settings. */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** A `plumbline` command class. */
type CommandClass = typeof Scan | typeof Checks;

/** What a command run printed, and the status it ended with. */
export interface CommandRun {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** The exit status oclif put on an error it threw, if any. */
function exitOf(error: unknown): number | undefined {
  const oclif = (error as { oclif?: { exit?: unknown } } | null)?.oclif;
  return typeof oclif?.exit === 'number' ? oclif.exit : undefined;
}

/**
 * Run `Command` through oclif with `argv`, writing into strings and scanning
 * with `dependencies`. An error oclif ends the run with becomes its status, and
 * its message goes to stderr, as oclif would print it.
 */
export async function runCommand(
  Command: CommandClass,
  argv: string[],
  dependencies: Dependencies,
): Promise<CommandRun> {
  const out: string[] = [];
  const err: string[] = [];
  // Both commands share their base, so either can stand in as the parent here.
  class Under extends (Command as typeof Scan) {
    protected override io() {
      return {
        stdout: (text: string) => out.push(text),
        stderr: (text: string) => err.push(text),
      };
    }

    protected override dependencies(): Dependencies {
      return dependencies;
    }
  }
  let code = 0;
  // oclif sets `process.exitCode` on a failed run, which Jest would exit with.
  const exitCode = process.exitCode;
  try {
    await Under.run(argv, ROOT);
  } catch (error) {
    const exit = exitOf(error);
    if (exit === undefined) {
      throw error;
    }
    code = exit;
    if (exit !== 1 && exit !== 3 && error instanceof Error) {
      err.push(error.message);
    }
  } finally {
    process.exitCode = exitCode;
  }
  return { code, stdout: out.join(''), stderr: err.join('') };
}
