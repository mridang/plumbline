/**
 * @packageDocumentation
 *
 * `list_domains`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { CHECKS, enabledChecks } from '@/domain/checks/catalogue';
import { listDomains } from '@/domain/db/domains';
import { listReports } from '@/domain/db/reports';
import {
  type ToolContent,
  type ToolContext,
} from '@/domain/mcp/tool-context';
import { domainListResult } from '@/domain/mcp/tool-results';
import {
  DOMAIN_LIST_OUTPUT_SCHEMA,
  viewMeta,
} from '@/domain/mcp/tools/schemas';
import { DOMAIN_LIST_RESOURCE_URI } from '@/domain/mcp/ui-resources';
import {
  type JsonSchema,
  McpTool,
  READS,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
} from '@/lib/mcp';

export class ListDomainsTool extends McpTool<
  'list_domains',
  ToolContext,
  ToolContent
> {
  readonly name = 'list_domains';

  readonly title = 'List domains';

  readonly description =
    "Lists the user's domains, with how many checks run for each and how its newest scan went.";

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
  };

  override readonly outputSchema: JsonSchema = DOMAIN_LIST_OUTPUT_SCHEMA;

  override readonly meta = viewMeta(
    DOMAIN_LIST_RESOURCE_URI,
    'Listing your domains…',
    'Here they are',
  );

  readonly annotations: ToolAnnotations = READS;

  override readonly backend = 'the database';

  override async handle(
    _args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const db = services.openDatabase();
    const domains = await listDomains(db, user.id);
    const rows = await Promise.all(
      domains.map(async (domain) => {
        const [latest] = await listReports(db, user.id, domain.id, 1);
        return {
          domain,
          checks: enabledChecks(domain.checks).length,
          ...(latest ? { latest } : {}),
        };
      }),
    );
    return domainListResult(rows, CHECKS.length);
  }
}
