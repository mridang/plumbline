import { Flags } from '@oclif/core';

import { CHECKS_FORMATS } from '../options.js';
import { resolveDependencies, runChecks } from '../run.js';
import { PlumblineCommand } from './base.js';

/**
 * `plumbline checks`: list every check with its id, name, groups and
 * description, optionally only those of some groups, tiers or targets.
 */
export default class Checks extends PlumblineCommand {
  static override readonly id = 'checks';

  static override readonly summary =
    'List every check, with its id, groups and description.';

  static override readonly examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --group owasp --format json',
  ];

  static override readonly flags = {
    group: Flags.string({
      char: 'g',
      multiple: true,
      multipleNonGreedy: true,
      delimiter: ',',
      summary:
        'List only the checks in these sections, tags, sources or targets.',
    }),
    tier: Flags.string({
      multiple: true,
      multipleNonGreedy: true,
      delimiter: ',',
      options: ['recommended', 'advanced', 'experimental'],
      summary: 'List only the checks of these tiers.',
    }),
    target: Flags.string({
      multiple: true,
      multipleNonGreedy: true,
      delimiter: ',',
      options: ['web', 'mail', 'site'],
      summary: 'List only the checks that look at these targets.',
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
          tiers: (flags.tier ?? []).map((t) => t.trim()).filter(Boolean),
          targets: (flags.target ?? []).map((t) => t.trim()).filter(Boolean),
          format: flags.format,
        },
        this.io(),
        deps.catalogue(),
      ),
    );
  }
}
