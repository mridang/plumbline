import { agentHint } from './define-agent-hint.js';

/**
 * Isitagentready.com check. Discovery: needs a browser connector; tools registered by the page are callable by in-browser agents.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-webmcp',
  name: 'WebMCP tools',
  description:
    'Requires the page to expose WebMCP tools (modelContext or toolname forms).',
  reference: 'https://webmachinelearning.github.io/webmcp/',
});
