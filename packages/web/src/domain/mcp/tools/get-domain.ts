/**
 * @packageDocumentation
 *
 * `get_domain`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { CHECKS, enabledChecks } from '@/domain/checks/catalogue';
import { type Domain } from '@/domain/db/domains';
import { listReports } from '@/domain/db/reports';
import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { domainLink, tallyLine } from '@/domain/mcp/tool-results';
import { DomainTool } from '@/domain/mcp/tools/domain-tool';
import { DOMAIN } from '@/domain/mcp/tools/schemas';
import {
  type JsonSchema,
  READS,
  textResult,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
} from '@/lib/mcp';

export class GetDomainTool extends DomainTool<'get_domain'> {
  readonly name = 'get_domain';

  readonly title = 'Show a domain';

  readonly description =
    "Shows one of the user's domains: which checks run for it (or that all do), the ones switched off, and how its newest scan went.";

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: { domain: DOMAIN },
    required: ['domain'],
  };

  readonly annotations: ToolAnnotations = READS;

  protected override async handleForDomain(
    domain: Readonly<Domain>,
    _args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const db = services.openDatabase();
    const on = enabledChecks(domain.checks);
    const off = CHECKS.filter((check) => !on.includes(check.id));
    const offMore = off.length > 100 ? `, and ${off.length - 100} more` : '';
    const [latest] = await listReports(db, user.id, domain.id, 1);
    return textResult(
      [
        `${domain.host} (id ${domain.id}), added ${domain.created_at}.`,
        domain.checks === null
          ? `Every check runs (${CHECKS.length}).`
          : `${on.length} of ${CHECKS.length} checks run.`,
        ...(off.length > 0
          ? [
              `Switched off: ${off
                .slice(0, 100)
                .map((check) => check.id)
                .join(', ')}${offMore}.`,
            ]
          : []),
        latest
          ? `Newest scan ${latest.created_at}: ${tallyLine(latest)}.`
          : 'Not scanned yet.',
        `Page: ${domainLink(domain)}`,
      ].join('\n'),
    );
  }
}
