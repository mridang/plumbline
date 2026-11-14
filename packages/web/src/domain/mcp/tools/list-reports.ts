/**
 * @packageDocumentation
 *
 * `list_reports`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type Domain } from '@/domain/db/domains';
import { listReports } from '@/domain/db/reports';
import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { tallyLine } from '@/domain/mcp/tool-results';
import { DomainTool } from '@/domain/mcp/tools/domain-tool';
import { DOMAIN } from '@/domain/mcp/tools/schemas';
import { countOf } from '@/lib/intl';
import {
  type ArgumentSpellings,
  READS,
  textResult,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
} from '@/lib/mcp';
import { z } from 'zod';

export class ListReportsTool extends DomainTool<'list_reports'> {
  readonly name = 'list_reports';

  readonly title = 'List reports';

  readonly description =
    "Lists the saved reports of one of the user's domains, newest first, with their ids and counts.";

  readonly input = z
    .object({
      domain: DOMAIN,
    })
    .strict();

  readonly annotations: ToolAnnotations = READS;

  override readonly spellings: ArgumentSpellings = {
    aliases: { host: 'domain', url: 'domain' },
  };

  protected override async handleForDomain(
    domain: Readonly<Domain>,
    _args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const db = services.openDatabase();
    const reports = await listReports(db, user.id, domain.id, 100);
    return textResult(
      reports.length === 0
        ? `${domain.host} has no saved reports yet.`
        : [
            `${countOf(reports.length, 'report')} for ${domain.host}, newest first:`,
            ...reports.map(
              (report) =>
                `- ${report.id} (${report.created_at}): ${tallyLine(report)}`,
            ),
          ].join('\n'),
    );
  }
}
