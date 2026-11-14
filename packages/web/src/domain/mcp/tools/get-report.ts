/**
 * @packageDocumentation
 *
 * `get_report`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type Domain } from '@/domain/db/domains';
import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { reportResult } from '@/domain/mcp/tool-results';
import { namedReport } from '@/domain/mcp/tools/domain-support';
import { DomainTool } from '@/domain/mcp/tools/domain-tool';
import {
  DOMAIN,
  REPORT_OUTPUT_SCHEMA,
  viewMeta,
  WIDGET_CALLABLE,
} from '@/domain/mcp/tools/schemas';
import { REPORT_RESOURCE_URI } from '@/domain/mcp/ui-resources';
import {
  type ArgumentSpellings,
  errorResult,
  type JsonSchema,
  READS,
  stringArg,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
} from '@/lib/mcp';
import { z } from 'zod';

export class GetReportTool extends DomainTool<'get_report'> {
  readonly name = 'get_report';

  readonly title = 'Show a report';

  readonly description =
    "Shows a saved report of one of the user's domains: when it was scanned, how many checks passed, warned, failed and were skipped, and what each failing or warning check found. The newest report unless `report` names an older one (from list_reports).";

  readonly input = z
    .object({
      domain: DOMAIN,
      report: z
        .string()
        .max(64)
        .describe('The id of an older report, from list_reports.')
        .optional(),
    })
    .strict();

  override readonly outputSchema: JsonSchema = REPORT_OUTPUT_SCHEMA;

  override readonly meta = {
    ...viewMeta(REPORT_RESOURCE_URI, 'Reading the report…', 'Here it is'),
    ...WIDGET_CALLABLE,
  };

  readonly annotations: ToolAnnotations = READS;

  override readonly spellings: ArgumentSpellings = {
    aliases: { host: 'domain', url: 'domain' },
  };

  protected override async handleForDomain(
    domain: Readonly<Domain>,
    args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const db = services.openDatabase();
    const id = stringArg(args['report']);
    const report = await namedReport(db, user.id, domain.id, id);
    if (!report) {
      return id === ''
        ? errorResult(
            `${domain.host} has not been scanned yet. Use scan_domain to see how to scan it.`,
          )
        : errorResult(
            `${domain.host} has no report with that id. Use list_reports to see them.`,
          );
    }
    return reportResult(domain, report);
  }
}
