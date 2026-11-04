import { Flags } from '@oclif/core';

import { CHECKS_FORMATS } from '../options.js';
import { resolveDependencies, runChecks } from '../run.js';
import { PlumblineCommand } from './base.js';

/**
 * `plumbline checks`: list every check with its id, name, groups and
 * description, optionally only those of some groups.
 */
export default class Checks extends PlumblineCommand {
  static override id = 'checks';

  static override summary =
    'List every check, with its id, groups and description.';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --group owasp --format json',
  ];

  static override flags = {
    group: Flags.string({
      char: 'g',
      multiple: true,
      multipleNonGreedy: true,
      delimiter: ',',
      summary: 'List only the checks in these groups.',
    }),
    format: Flags.option({
      char: 'f',
      options: CHECKS_FORMATS,
      default: 'text',
      summary: 'How to print the list.',
    })(),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Checks);
    const deps = resolveDependencies(this.dependencies());
    await this.finish(() =>
      runChecks(
        {
          kind: 'checks',
          groups: (flags.group ?? []).map((g) => g.trim()).filter(Boolean),
          format: flags.format,
        },
        this.io(),
        deps.catalogue(),
      ),
    );
  }
}
