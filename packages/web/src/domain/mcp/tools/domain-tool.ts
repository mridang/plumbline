/**
 * @packageDocumentation
 *
 * The base of the tools that act on one of the user's domains.
 *
 * Six of this app's tools take a `domain` argument and have to resolve it to a
 * domain the person owns before they do anything. Doing that in each of them
 * would be the same lookup six times, and a tool that forgot it would act on
 * someone else's site. {@link DomainTool} does it once: a subclass says what to
 * do with a domain it has been given, and never sees a call that named one the
 * person does not own.
 */

import { type Domain } from '@/domain/db/domains';
import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { ownDomain } from '@/domain/mcp/tools/domain-support';
import { McpTool, type ToolArgs, type ToolResult } from '@/lib/mcp';

/**
 * A tool that acts on one domain of the user's, named by the `domain` argument
 * as a host, a URL on it or the domain's id.
 */
export abstract class DomainTool<TName extends string> extends McpTool<
  TName,
  ToolContext,
  ToolContent
> {
  /**
   * Find the domain the call names and hand it to {@link handleForDomain}, or
   * answer why not. A `domain` that is not a host, URL or id, and one that
   * names no domain of this user's, are both refusals the assistant can act on.
   */
  override async handle(
    args: ToolArgs,
    context: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const found = await ownDomain(
      context.services.openDatabase(),
      context.user,
      args,
    );
    return 'refusal' in found
      ? found.refusal
      : this.handleForDomain(found.domain, args, context);
  }

  /**
   * Run the call against a domain the user owns.
   * @param domain - The domain the call named, already theirs.
   * @param args - The checked arguments of the call.
   * @param context - What the app hands its tools.
   */
  protected abstract handleForDomain(
    domain: Readonly<Domain>,
    args: ToolArgs,
    context: ToolContext,
  ): Promise<ToolResult<ToolContent>>;
}
