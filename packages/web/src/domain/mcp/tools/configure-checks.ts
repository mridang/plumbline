/**
 * @packageDocumentation
 *
 * `configure_checks`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import {
  applyChoice,
  CHECKS,
  enabledChecks,
  expandSelection,
} from '@/domain/checks/catalogue';
import { type Domain, setDomainChecks } from '@/domain/db/domains';
import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { checkName } from '@/domain/mcp/tool-results';
import { DomainTool } from '@/domain/mcp/tools/domain-tool';
import { CHECK_NAMES, DOMAIN } from '@/domain/mcp/tools/schemas';
import {
  type ArgumentSpellings,
  errorResult,
  stringListArg,
  textResult,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
  writes,
} from '@/lib/mcp';
import { z } from 'zod';

export class ConfigureChecksTool extends DomainTool<'configure_checks'> {
  readonly name = 'configure_checks';

  readonly title = 'Choose checks';

  readonly description =
    "Chooses which checks run for one of the user's domains: `enable` and `disable` take check ids or group names (tls, owasp, seo, …), and `all` switches every check on first. Returns how many checks now run.";

  readonly input = z
    .object({
      domain: DOMAIN,
      all: z
        .boolean()
        .describe('Switch every check on before applying enable and disable.')
        .optional(),
      enable: CHECK_NAMES.describe(
        'Check ids or group names to switch on.',
      ).optional(),
      disable: CHECK_NAMES.describe(
        'Check ids or group names to switch off.',
      ).optional(),
    })
    .strict();

  readonly annotations: ToolAnnotations = writes({ idempotent: true });

  override readonly spellings: ArgumentSpellings = {
    aliases: { host: 'domain', url: 'domain', checks: 'enable' },
    listsOfText: ['enable', 'disable'],
  };

  protected override async handleForDomain(
    domain: Readonly<Domain>,
    args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const db = services.openDatabase();
    const enable = expandSelection(stringListArg(args['enable']));
    const disable = expandSelection(stringListArg(args['disable']));
    const unknown = [...enable.unknown, ...disable.unknown];
    if (unknown.length > 0) {
      return errorResult(
        `Not a check or a group: ${unknown
          .slice(0, 10)
          .map((name) => `"${name.slice(0, 80)}"`)
          .join(', ')}. Use list_checks to see the ids and groups.`,
      );
    }
    const start = args['all'] === true ? null : domain.checks;
    const chosen = applyChoice(start, {
      enable: enable.ids,
      disable: disable.ids,
    });
    await setDomainChecks(db, user.id, domain.id, chosen);
    const count = enabledChecks(chosen).length;
    const changed = [
      ...enable.ids.slice(0, 5).map((id) => `on: ${checkName(id)}`),
      ...disable.ids.slice(0, 5).map((id) => `off: ${checkName(id)}`),
    ];
    const scope =
      chosen === null
        ? `every check (${count})`
        : `${count} of ${CHECKS.length} checks`;
    const more =
      enable.ids.length + disable.ids.length > changed.length
        ? ', and more'
        : '';
    const changedText =
      changed.length > 0 ? ` Changed ${changed.join('; ')}${more}.` : '';
    return textResult(`${domain.host} now runs ${scope}.${changedText}`);
  }
}
