import { agentHint } from './define-agent-hint.js';

/**
 * isitagentready.com check. Discovery: SEP-1649 / SEP-2127 server cards describe an MCP server before connecting.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-mcp-server-card',
  name: 'MCP server card',
  description:
    'Requires an MCP server card with serverInfo and a transport endpoint.',
  reference:
    'https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1649',
});
