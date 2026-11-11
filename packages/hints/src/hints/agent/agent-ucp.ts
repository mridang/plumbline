import { agentHint } from './define-agent-hint.js';

/**
 * Isitagentready.com check. Commerce, informational.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-ucp',
  name: 'Universal Commerce Protocol',
  description: 'Reports whether /.well-known/ucp is published.',
  reference: 'https://ucp.dev/latest/specification/overview/',
  informational: true,
});
