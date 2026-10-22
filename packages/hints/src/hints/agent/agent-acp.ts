import { agentHint } from './define-agent-hint.js';

/**
 * isitagentready.com check. Commerce, informational.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-acp',
  name: 'Agentic Commerce Protocol',
  description: 'Reports whether /.well-known/acp.json is published.',
  reference:
    'https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/blob/main/rfcs/rfc.discovery.md',
  informational: true,
});
