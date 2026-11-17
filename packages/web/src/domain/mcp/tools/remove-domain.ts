/**
 * @packageDocumentation
 *
 * `remove_domain`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { z } from 'zod';
import { deleteDomain } from '@/domain/db/domains';
import { deleteReportsOf } from '@/domain/db/reports';
import { DomainTool } from '@/domain/mcp/tools/domain-tool';
import { DOMAIN } from '@/domain/mcp/tools/schemas';
import { textResult, writes } from '@/lib/mcp';
import type {
  ArgumentSpellings,
  ToolAnnotations,
  ToolArgs,
  ToolResult,
} from '@/lib/mcp';
import type { Domain } from '@/domain/db/domains';
import type { ToolContent, ToolContext } from '@/domain/mcp/tool-context';

export class RemoveDomainTool extends DomainTool<'remove_domain'> {
  readonly name = 'remove_domain';

  readonly title = 'Remove a domain';

  readonly description =
    "Removes a domain from the user's list, with all of its saved reports.";

  readonly input = z
    .object({
      domain: DOMAIN,
    })
    .strict();

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
