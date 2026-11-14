/**
 * @packageDocumentation
 *
 * `list_repositories`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { overviewOf } from '@/domain/db/live';
import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import {
  McpTool,
  READS,
  textResult,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
} from '@/lib/mcp';
import { z } from 'zod';

export class ListRepositoriesTool extends McpTool<
  'list_repositories',
  ToolContext,
  ToolContent
> {
  readonly name = 'list_repositories';

  readonly title = 'List repositories';

  readonly description =
    'Lists the repositories whose sites the user can see on their Plumbline dashboard: the ones they added themselves and every site of the GitHub repositories they have access to, with how each site stands now (checking, failing, with warnings, all clear, not answering or not checked yet).';

  readonly input = z.object({}).strict();

  readonly annotations: ToolAnnotations = READS;

  override readonly backend = 'the database';

  override async handle(
    _args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const db = services.openDatabase();
    const repos = await overviewOf(db, user.id);
    if (repos.length === 0) {
      return textResult(
        'No repositories yet. Connect GitHub on Plumbline to see the sites of the repositories you have access to.',
      );
    }
    const lines = repos.flatMap((repo) => [
      `${repo.repo ?? 'Added by hand'}:`,
      ...repo.sites.map(
        (site) =>
          `  ${site.host}: ${site.state} (${site.errors} errors, ${site.warnings} warnings, ${site.hints} hints)`,
      ),
    ]);
    return textResult(lines.join('\n'));
  }
}
