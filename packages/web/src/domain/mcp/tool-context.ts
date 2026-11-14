/**
 * @packageDocumentation
 *
 * What this app hands its tools, and how it answers the two questions the MCP
 * library asks of every app: which scopes it offers, and which of its own
 * failures are worth explaining to an assistant.
 */

import { NoExplanations, ReadWriteScopes } from '@/lib/mcp';
import type { DomainListData, ReportData } from '@/domain/mcp/ui-types';
import type { User } from '@/domain/db/users';
import { SCOPE_READ, SCOPE_WRITE } from '@/domain/mcp/app';
import {
  liveToolServices,
  type ToolServices,
} from '@/domain/mcp/tool-services';

/**
 * What every tool in this app is given: who is calling, and the outside things
 * the tools reach for. The database is opened through `services` when a tool
 * asks for it.
 */
export interface ToolContext {
  readonly user: Readonly<User>;
  readonly services: ToolServices;
}

/**
 * The context for a real call.
 * @param user - Who is calling.
 * @param services - What this app's tools reach for; a test passes fakes.
 */
export function toolContext(
  user: Readonly<User>,
  services: ToolServices = liveToolServices,
): ToolContext {
  return { user, services };
}

/**
 * What this app's tools return as structured content: whatever the report view
 * or the domain-list view draws. A tool that answers in words alone returns
 * none.
 */
export type ToolContent = ReportData | DomainListData;

/** Which sign-in a call needs, by what the tool says about its own effects. */
export const TOOL_SCOPES = new ReadWriteScopes(SCOPE_READ, SCOPE_WRITE);

/**
 * This app has no recoverable failure of its own: a failure is either a backend
 * failure or a mistake in this code.
 */
export const TOOL_FAILURES = new NoExplanations();
