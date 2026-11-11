import { agentHint } from './define-agent-hint.js';

/**
 * Isitagentready.com check. Discovery: human and agent readable instructions for registering an agent.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-auth-md',
  name: 'auth.md',
  description: 'Requires /auth.md with agent registration instructions.',
  reference: 'https://isitagentready.com',
});
