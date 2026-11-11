import { agentHint } from './define-agent-hint.js';

/**
 * Isitagentready.com check. Discovery (not scored): organisation manifest for personal agents.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-poppy',
  name: 'Personal Agent Protocol',
  description: 'Requires a valid /.well-known/poppy.json.',
  reference: 'https://personalagentprotocol.org',
});
