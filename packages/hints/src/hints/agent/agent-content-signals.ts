import { agentHint } from './define-agent-hint.js';

/**
 * Isitagentready.com check. Bot access control: states whether content may be used for ai-train, search and ai-input.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-content-signals',
  name: 'Content Signals',
  description: 'Requires a Content-Signal directive in robots.txt.',
  reference: 'https://blog.cloudflare.com/content-signals-policy/',
  extraGroups: ['privacy'],
});
