import { agentHint } from './define-agent-hint.js';

/**
 * Isitagentready.com check. Discovery (not scored): a catalog of agent-usable resources with urn:air ids.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-ard',
  name: 'Agentic Resource Discovery catalog',
  description: 'Requires a valid AI catalog at /.well-known/ard.json.',
  reference: 'https://agenticresourcediscovery.org/spec',
  extraGroups: ['dns'],
});
