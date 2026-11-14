/**
 * @packageDocumentation
 *
 * Every tool this app offers. Adding one means writing its class beside this
 * file and naming it here; nothing else holds a list to keep in step.
 */

import { ToolRegistry, type NameOf } from '@/lib/mcp';
import type { ToolContent, ToolContext } from '@/domain/mcp/tool-context';
import { ListChecksTool } from '@/domain/mcp/tools/list-checks';
import { ListDomainsTool } from '@/domain/mcp/tools/list-domains';
import { ListRepositoriesTool } from '@/domain/mcp/tools/list-repositories';
import { GetDomainTool } from '@/domain/mcp/tools/get-domain';
import { GetReportTool } from '@/domain/mcp/tools/get-report';
import { ListReportsTool } from '@/domain/mcp/tools/list-reports';
import { ScanDomainTool } from '@/domain/mcp/tools/scan-domain';
import { RemoveDomainTool } from '@/domain/mcp/tools/remove-domain';
import { ConfigureChecksTool } from '@/domain/mcp/tools/configure-checks';

export { ListChecksTool } from '@/domain/mcp/tools/list-checks';
export { ListDomainsTool } from '@/domain/mcp/tools/list-domains';
export { ListRepositoriesTool } from '@/domain/mcp/tools/list-repositories';
export { GetDomainTool } from '@/domain/mcp/tools/get-domain';
export { GetReportTool } from '@/domain/mcp/tools/get-report';
export { ListReportsTool } from '@/domain/mcp/tools/list-reports';
export { ScanDomainTool } from '@/domain/mcp/tools/scan-domain';
export { RemoveDomainTool } from '@/domain/mcp/tools/remove-domain';
export { ConfigureChecksTool } from '@/domain/mcp/tools/configure-checks';

/**
 * Every tool, in the order the catalogue lists them. Declared `as const` so
 * that {@link ToolName} is the union of the real names rather than `string`.
 */
const TOOLS = [
  new ListChecksTool(),
  new ListDomainsTool(),
  new ListRepositoriesTool(),
  new GetDomainTool(),
  new GetReportTool(),
  new ListReportsTool(),
  new ScanDomainTool(),
  new RemoveDomainTool(),
  new ConfigureChecksTool(),
] as const;

/** The name of one of this app's tools. */
export type ToolName = NameOf<typeof TOOLS>;

/** Every tool this app offers, looked up by name. */
export const TOOL_REGISTRY = new ToolRegistry<
  ToolName,
  ToolContext,
  ToolContent
>(TOOLS);
