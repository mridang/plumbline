import { agentHint } from './define-agent-hint.js';

/**
 * isitagentready.com check. Commerce, informational.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-mpp',
  name: 'Machine Payment Protocol',
  description: 'Reports whether /openapi.json advertises x-payment-info (MPP).',
  reference: 'https://mpp.dev',
  informational: true,
});
