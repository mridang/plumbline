import { agentHint } from './define-agent-hint.js';

/**
 * Isitagentready.com check. Commerce, informational.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-x402',
  name: 'x402 payments',
  description:
    'Reports whether an endpoint answers 402 Payment Required (x402).',
  reference: 'https://docs.x402.org',
  informational: true,
});
