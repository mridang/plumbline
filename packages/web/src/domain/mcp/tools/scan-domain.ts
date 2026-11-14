/**
 * @packageDocumentation
 *
 * `scan_domain`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type Domain } from '@/domain/db/domains';
import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { domainLink } from '@/domain/mcp/tool-results';
import { CLI_COMMAND } from '@/domain/mcp/tools/domain-support';
import { DomainTool } from '@/domain/mcp/tools/domain-tool';
import { DOMAIN } from '@/domain/mcp/tools/schemas';
import {
  type ArgumentSpellings,
  type JsonSchema,
  READS,
  textResult,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
} from '@/lib/mcp';

export class ScanDomainTool extends DomainTool<'scan_domain'> {
  readonly name = 'scan_domain';

  readonly title = 'Scan a domain';

  readonly description =
    "Says how to scan one of the user's domains: the Plumbline page that runs its checks in the browser and saves a report, and the CLI command that runs every check (TLS and mail included) on the user's own machine. The checks never run on the server, so this starts nothing by itself.";

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: { domain: DOMAIN },
    required: ['domain'],
  };

  readonly annotations: ToolAnnotations = READS;

  override readonly spellings: ArgumentSpellings = {
    aliases: { host: 'domain', url: 'domain' },
  };

  protected override async handleForDomain(
    domain: Readonly<Domain>,
    _args: ToolArgs,
    _context: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    return textResult(
      [
        `The checks for ${domain.host} run outside this server.`,
        `- In the browser: open ${domainLink(domain)} and press "Run checks". It runs the checks chosen for the domain and saves a report, which get_report then reads.`,
        `- On the user's machine: \`${CLI_COMMAND} ${domain.host}\` runs every check, TLS and mail included, and prints the findings (add \`--format json\` for machine-readable output).`,
      ].join('\n'),
    );
  }
}
