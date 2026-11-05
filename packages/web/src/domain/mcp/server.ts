/**
 * @packageDocumentation
 *
 * plumbline's MCP server: the domain and report methods registered on the
 * generic {@link McpServer} engine (see `@/lib/mcp/server`). It lets an
 * assistant (Claude, ChatGPT, …) work with the user's domains: list them and
 * the checks, read their reports, remove sites and choose which
 * checks run for each.
 *
 * The engine owns the JSON-RPC envelope (handshake vs modern era,
 * notifications, result dressing, faults); this file is the method table — the
 * tool catalogue is in `tool-definitions.ts`, what the tools do is in
 * `tool-calls.ts`, and what the server says about itself is in
 * `server-info.ts`.
 */

import type { User } from '@/domain/db/users';
import {
  ERROR_INVALID_PARAMS,
  InvalidToolArguments,
  McpServer,
  RpcError,
  SUPPORTED_VERSIONS,
  UnknownTool,
  isPlainObject,
  negotiateLegacyVersion,
  type CacheHint,
  type JsonRpcResponse,
} from '@/lib/mcp';
import {
  CAPABILITIES,
  INSTRUCTIONS,
  SERVER_INFO,
  SERVER_INFO_META_KEY,
} from '@/domain/mcp/server-info';
import { PROMPT_DEFINITIONS, getPrompt } from '@/domain/mcp/prompts';
import { callToolOrExplain } from '@/domain/mcp/tool-calls';
import { TOOLS } from '@/domain/mcp/tool-definitions';
import {
  APP_RESOURCES,
  RESOURCE_MIME_TYPE,
  findAppResource,
} from '@/domain/mcp/ui-resources';

export type { JsonRpcMessage, JsonRpcResponse } from '@/lib/mcp';

/** Runs a tool by name; the real one opens the database, so tests pass their own. */
export type ToolRunner = typeof callToolOrExplain;

/** The parameters a JSON-RPC message carries. */
type Params = Readonly<Record<string, unknown>> | undefined;

/** The per-request context the methods run against. */
interface McpContext {
  readonly user: Readonly<User>;
  readonly runTool: ToolRunner;
}

/**
 * How long a client may reuse a list or a read, and who may share the copy
 * (the newest revision asks for these on every cacheable result). Everything
 * the server lists or serves is the same for every user and changes only when a
 * new version is deployed, so every answer is `public`. The tool and view lists
 * are small, so five minutes bounds how stale a client can be after a deploy; a
 * view at its content-hashed address can never change (a new build is a new
 * address), so a day is safe; the discovery document describes nothing that
 * changes between deploys.
 */
export const CACHE_HINTS = {
  discover: { ttlMs: 3_600_000, cacheScope: 'public' },
  list: { ttlMs: 300_000, cacheScope: 'public' },
  read: { ttlMs: 900_000, cacheScope: 'public' },
  immutable: { ttlMs: 86_400_000, cacheScope: 'public' },
} as const satisfies Record<string, CacheHint>;

/**
 * Refuse a pagination cursor on a list that has only one page. Cursors are
 * opaque tokens the server hands out, and this server hands out none for these
 * lists, so any that arrives is one it did not issue (pagination says an invalid
 * cursor should be answered `-32602`). Absent, `null` and the empty string all
 * mean "from the start": some clients send one of them with a first request,
 * and refusing it would help nobody.
 */
function refuseCursor(params: Params): void {
  const cursor = params?.['cursor'];
  if (cursor !== undefined && cursor !== null && cursor !== '') {
    throw new RpcError(ERROR_INVALID_PARAMS, 'Invalid cursor');
  }
}

/** The answer to the older revisions' `initialize` handshake. */
function initializeResult(params: Params): object {
  return {
    protocolVersion: negotiateLegacyVersion(params?.['protocolVersion']),
    capabilities: CAPABILITIES,
    serverInfo: SERVER_INFO,
    instructions: INSTRUCTIONS,
  };
}

/** The newest revision's way to learn what a server is, with no handshake. */
function discoverResult(): object {
  return {
    supportedVersions: SUPPORTED_VERSIONS,
    capabilities: CAPABILITIES,
    instructions: INSTRUCTIONS,
  };
}

/** The answer to `resources/list`: the app's views. */
function resourceListResult(params: Params): object {
  refuseCursor(params);
  return {
    resources: APP_RESOURCES.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: RESOURCE_MIME_TYPE,
      _meta: r.meta,
    })),
  };
}

/** The answer to `resources/templates/list`: there are no templated resources. */
function resourceTemplateListResult(params: Params): object {
  refuseCursor(params);
  return { resourceTemplates: [] };
}

/**
 * The cache hints for a `resources/read` result: for a day when the view is
 * read at the content-hashed address it will always have, and for the shorter
 * time when it is read at a stale hashed address that gets the current view.
 */
export function readCache(result: object): CacheHint {
  const contents = 'contents' in result ? result.contents : undefined;
  const first: unknown = Array.isArray(contents) ? contents[0] : undefined;
  const uri =
    isPlainObject(first) && typeof first['uri'] === 'string'
      ? first['uri']
      : '';
  return findAppResource(uri)?.immutable
    ? CACHE_HINTS.immutable
    : CACHE_HINTS.read;
}

/** The reply to `resources/read`: a view's HTML, or an error for an address the server does not have. */
function readResource(params: Params): object {
  const uri = params?.['uri'];
  if (typeof uri !== 'string') {
    throw new RpcError(
      ERROR_INVALID_PARAMS,
      'resources/read needs a `uri`, as a string.',
    );
  }
  const resource = findAppResource(uri);
  if (!resource) {
    throw new RpcError(ERROR_INVALID_PARAMS, 'Resource not found', {
      uri: uri.slice(0, ECHO_LIMIT),
    });
  }
  return {
    contents: [
      {
        uri: resource.uri,
        mimeType: RESOURCE_MIME_TYPE,
        text: resource.html,
        _meta: resource.meta,
      },
    ],
  };
}

/** The answer to `prompts/get`. */
function promptResult(params: Params): object {
  return getPrompt(params?.['name'], params?.['arguments']);
}

/** The names of the tools the server advertises. */
const TOOL_NAMES: ReadonlySet<string> = new Set(TOOLS.map((t) => t.name));

/** Whether `name` is a tool the server advertises in `tools/list`. */
export function isAdvertisedTool(name: unknown): name is string {
  return typeof name === 'string' && TOOL_NAMES.has(name);
}

/** How much of a name or address a refusal repeats back; a client may send a megabyte of it. */
const ECHO_LIMIT = 120;

/** The refusal for a tool name the server does not have, listing the ones it does. */
function unknownToolError(name: unknown): RpcError {
  return new RpcError(
    ERROR_INVALID_PARAMS,
    `Unknown tool: ${typeof name === 'string' ? name.slice(0, ECHO_LIMIT) : 'no name given'}. The tools are ${[...TOOL_NAMES].join(', ')}.`,
  );
}

/**
 * Run a `tools/call`. The tool's name and the envelope of its arguments are
 * checked first, before anything is opened (so a typo costs nothing): an unknown tool, a missing name or
 * `arguments` that is not an object are malformed requests and answered `-32602`.
 * Arguments that are an object but do not fit the tool's schema are not: the
 * tool answers them itself, as an `isError` result that says what to change, so
 * the host shows the model the problem and the model can fix its call (the MCP
 * spec counts input validation among tool execution errors). A tool that still
 * reports its arguments as invalid by throwing is a malformed request too.
 */
async function callTool(params: Params, ctx: McpContext): Promise<object> {
  const name = params?.['name'];
  if (!isAdvertisedTool(name)) {
    throw unknownToolError(name);
  }
  const args = params?.['arguments'];
  if (args !== undefined && !isPlainObject(args)) {
    throw new RpcError(
      ERROR_INVALID_PARAMS,
      `Invalid arguments for tool ${name}: "arguments" must be an object.`,
    );
  }
  try {
    return await ctx.runTool(ctx.user, params);
  } catch (error) {
    if (error instanceof UnknownTool) {
      throw unknownToolError(error.tool);
    }
    if (error instanceof InvalidToolArguments) {
      throw new RpcError(
        ERROR_INVALID_PARAMS,
        `Invalid arguments for tool ${name}: ${error.problems.join(' ')}`,
        { tool: name, problems: error.problems },
      );
    }
    throw error;
  }
}

/** plumbline's MCP server: the engine with the methods registered. */
const server = new McpServer<McpContext>({
  serverInfo: SERVER_INFO,
  serverInfoMetaKey: SERVER_INFO_META_KEY,
})
  .register('initialize', { handle: initializeResult, legacyOnly: true })
  .register('server/discover', {
    handle: discoverResult,
    cache: CACHE_HINTS.discover,
    modernOnly: true,
  })
  .register('ping', { handle: () => ({}), legacyOnly: true })
  .register('tools/list', {
    handle: (params) => {
      refuseCursor(params);
      return { tools: TOOLS };
    },
    cache: CACHE_HINTS.list,
  })
  .register('tools/call', { handle: callTool })
  .register('resources/list', {
    handle: resourceListResult,
    cache: CACHE_HINTS.list,
  })
  .register('resources/templates/list', {
    handle: resourceTemplateListResult,
    cache: CACHE_HINTS.list,
  })
  .register('resources/read', { handle: readResource, cache: readCache })
  .register('prompts/list', {
    handle: (params) => {
      refuseCursor(params);
      return { prompts: PROMPT_DEFINITIONS };
    },
    cache: CACHE_HINTS.list,
  })
  .register('prompts/get', { handle: promptResult });

/**
 * Handle one JSON-RPC message. Returns the response object, or null for
 * notifications (which get an empty 202 from the route). `runTool` is what runs
 * a tool call (the real one unless a test supplies its own).
 */
export async function handleMcpMessage(
  user: Readonly<User>,
  message: Parameters<typeof server.handleMessage>[0],
  runTool: ToolRunner = callToolOrExplain,
): Promise<JsonRpcResponse | null> {
  return server.handleMessage(message, { user, runTool });
}
