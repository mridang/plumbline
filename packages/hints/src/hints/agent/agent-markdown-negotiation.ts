import { agentHint } from './define-agent-hint.js';

/**
 * isitagentready.com check. Content accessibility: markdown costs far fewer tokens than HTML.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-markdown-negotiation',
  name: 'Markdown for agents',
  description:
    'Requires text/markdown when the home page is requested with Accept: text/markdown.',
  reference:
    'https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/',
});
