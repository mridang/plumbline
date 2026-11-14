/**
 * @packageDocumentation
 *
 * `list_checks`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import {
  CHECKS,
  checksInGroup,
  GROUPS,
  isGroup,
} from '@/domain/checks/catalogue';
import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import {
  CHECKS_PAGE_DEFAULT,
  CHECKS_PAGE_MAX,
  OFFSET,
} from '@/domain/mcp/tools/schemas';
import { countOf } from '@/lib/intl';
import {
  errorResult,
  limitArg,
  McpTool,
  numberArg,
  offsetArg,
  READS,
  stringArg,
  textResult,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
} from '@/lib/mcp';
import { z } from 'zod';

export class ListChecksTool extends McpTool<
  'list_checks',
  ToolContext,
  ToolContent
> {
  readonly name = 'list_checks';

  readonly title = 'List checks';

  readonly description =
    'Lists the checks Plumbline can run, with their ids, names, groups and what each looks at, 50 at a time in id order. Narrow it to one group (a source such as owasp or a topic such as tls) or to checks whose id, name or description contains some text. Without arguments it starts with the list of groups.';

  readonly input = z
    .object({
      group: z
        .string()
        .max(100)
        .describe('Only the checks in this group, such as tls or seo.')
        .optional(),
      query: z
        .string()
        .max(200)
        .describe('Only checks whose id, name or description has this text.')
        .optional(),
      limit: z
        .int()
        .min(1)
        .max(CHECKS_PAGE_MAX)
        .describe(
          `Most checks to return (default ${CHECKS_PAGE_DEFAULT}, at most ${CHECKS_PAGE_MAX}).`,
        )
        .optional(),
      offset: OFFSET,
    })
    .strict();

  readonly annotations: ToolAnnotations = READS;

  override async handle(
    args: ToolArgs,
    _context: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const group = stringArg(args['group']);
    if (group !== '' && !isGroup(group)) {
      return errorResult(
        `There is no group "${group.slice(0, 80)}". The groups are ${GROUPS.join(', ')}.`,
      );
    }
    const query = stringArg(args['query']).toLowerCase();
    const pool = (group === '' ? CHECKS : checksInGroup(group)).filter(
      (check) =>
        query === '' ||
        `${check.id} ${check.name} ${check.description}`
          .toLowerCase()
          .includes(query),
    );
    // Not limitArg: it caps every tool at 50, and a page of checks may hold more.
    const asked = numberArg(args['limit']);
    const limit = Math.min(
      asked === undefined
        ? CHECKS_PAGE_DEFAULT
        : Math.max(Math.floor(asked), 1),
      CHECKS_PAGE_MAX,
    );
    const offset = offsetArg(args['offset']);
    const page = pool.slice(offset, offset + limit);
    const groupText = group ? ` in ${group}` : '';
    const queryText = query ? ` matching "${query}"` : '';
    const lines = [
      ...(group === '' && query === '' && offset === 0
        ? [`Groups: ${GROUPS.join(', ')}.`, '']
        : []),
      `${countOf(pool.length, 'check')}${groupText}${queryText}; showing ${page.length} from ${offset}.`,
      ...page.map(
        (check) =>
          `- ${check.id}: ${check.name} [${check.groups.join(', ')}] ${check.description}`,
      ),
    ];
    if (offset + page.length < pool.length) {
      lines.push(`More: call again with offset ${offset + page.length}.`);
    }
    return textResult(lines.join('\n'));
  }
}
