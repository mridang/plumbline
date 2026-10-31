import { Command } from '@oclif/core';

import { EXIT } from '../exit-code.js';
import { UsageError } from '../options.js';
import type { Dependencies, Io } from '../run.js';

/**
 * What every `plumbline` command shares: where it writes, what it scans with,
 * and how a run ends. A test subclasses a command and replaces `io` and
 * `dependencies`, so the commands can be run through oclif without a browser.
 */
export abstract class PlumblineCommand extends Command {
  /** Where the command writes: stdout for results, stderr for progress. */
  protected io(): Io {
    return {
      stdout: (text) => process.stdout.write(text),
      stderr: (text) => process.stderr.write(text),
    };
  }

  /** Replacements for the scan, catalogue and version; none outside tests. */
  protected dependencies(): Dependencies {
    return {};
  }

  /**
   * End the run with `status`: nothing more for success, oclif's exit for any
   * other status, and oclif's error (printed with a pointer to `--help`, and
   * the usage status) for a {@link UsageError}.
   */
  protected async finish(work: () => Promise<number> | number): Promise<void> {
    let status: number;
    try {
      status = await work();
    } catch (error) {
      if (error instanceof UsageError) {
        const help = ['plumbline', this.id, '--help'].filter(Boolean).join(' ');
        this.error(`${error.message}\nRun "${help}" for usage.`, {
          exit: EXIT.usage,
        });
      }
      throw error;
    }
    if (status !== EXIT.ok) {
      this.exit(status);
    }
  }
}
