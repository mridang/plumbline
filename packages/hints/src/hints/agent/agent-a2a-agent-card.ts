import { agentHint } from './define-agent-hint.js';

/**
 * Isitagentready.com check. Discovery: the A2A agent card advertises skills and endpoints.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-a2a-agent-card',
  name: 'A2A agent card',
  description: 'Requires an A2A agent card at /.well-known/agent-card.json.',
  reference: 'https://a2a-protocol.org/latest/specification/',
});
