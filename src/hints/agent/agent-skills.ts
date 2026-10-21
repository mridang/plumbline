import { agentHint } from './define-agent-hint.js';

/**
 * isitagentready.com check. Discovery: /.well-known/agent-skills/index.json (Cloudflare agent-skills-discovery RFC) lists installable skills.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-skills',
  name: 'Agent skills index',
  description:
    'Requires an agent skills index with name, type, description, url and digest per skill.',
  reference: 'https://github.com/cloudflare/agent-skills-discovery-rfc',
});
