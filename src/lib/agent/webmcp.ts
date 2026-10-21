import type { AgentEnv, CheckResult } from './types.js';
import { isRecord, result } from './util.js';

/**
 * Runs in the page. The WebMCP explainer attaches the API to the document:
 * `document.modelContext.getTools()` resolves to the registered tools
 * (`registerTool` is how a page registers them). UNVERIFIED:
 * `navigator.modelContext` and `listTools()` are kept as fallbacks for
 * earlier implementations, and `form[toolname]` (the declarative API) could
 * not be confirmed in the part of the spec that was read.
 */
export const WEBMCP_SCRIPT = `(async () => {
  const mc = document.modelContext || navigator.modelContext;
  let tools = 0;
  if (mc) {
    try {
      const fn = mc.getTools || mc.listTools;
      const list = typeof fn === 'function' ? await fn.call(mc) : mc.tools;
      tools = Array.isArray(list) ? list.length : 0;
    } catch (e) { tools = 0; }
  }
  return {
    api: Boolean(mc),
    tools,
    forms: document.querySelectorAll('form[toolname]').length,
  };
})()`;

/**
 * WebMCP: the page exposes tools to agents, either registered through
 * `modelContext` or declared on `<form toolname tooldescription>`. Needs a
 * browser based connector; without one the check cannot pass.
 */
export async function checkWebMcp(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-webmcp';
  if (!env.evaluate) {
    return result(
      id,
      'discovery',
      false,
      'No browser was available to look for WebMCP tools.',
    );
  }
  let value: unknown;
  try {
    value = await env.evaluate(WEBMCP_SCRIPT);
  } catch {
    return result(
      id,
      'discovery',
      false,
      'The page could not be evaluated for WebMCP tools.',
    );
  }
  const tools =
    isRecord(value) && typeof value.tools === 'number' ? value.tools : 0;
  const forms =
    isRecord(value) && typeof value.forms === 'number' ? value.forms : 0;
  return tools + forms > 0
    ? result(
        id,
        'discovery',
        true,
        `The page registers ${tools} tool(s) and ${forms} declarative form tool(s).`,
      )
    : result(id, 'discovery', false, 'The page registers no WebMCP tools.');
}
