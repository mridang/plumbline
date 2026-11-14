/**
 * @packageDocumentation
 *
 * `remove_domain`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { deleteDomain, type Domain } from '@/domain/db/domains';
import { deleteReportsOf } from '@/domain/db/reports';
import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { DomainTool } from '@/domain/mcp/tools/domain-tool';
import { DOMAIN } from '@/domain/mcp/tools/schemas';
import {
  type ArgumentSpellings,
  type JsonSchema,
  textResult,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
  writes,
} from '@/lib/mcp';

export class RemoveDomainTool extends DomainTool<'remove_domain'> {
  readonly name = 'remove_domain';

  readonly title = 'Remove a domain';

  readonly description =
    "Removes a domain from the user's list, with all of its saved reports.";

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: { domain: DOMAIN },
    required: ['domain'],
  };

  readonly annotations: ToolAnnotations = writes({
    destructive: true,
    idempotent: true,
  });

  override readonly spellings: ArgumentSpellings = {
    aliases: { host: 'domain', url: 'domain' },
  };

  protected override async handleForDomain(
    domain: Readonly<Domain>,
    _args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const db = services.openDatabase();
    await deleteDomain(db, user.id, domain.id);
    await deleteReportsOf(db, user.id, domain.id);
    return textResult(`Removed ${domain.host} and its saved reports.`);
  }
}
