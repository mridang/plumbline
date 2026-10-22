import { agentHint } from './define-agent-hint.js';

/**
 * isitagentready.com check. Bot access control: explicit rules for GPTBot, ClaudeBot and others, not only a wildcard group.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-ai-bot-rules',
  name: 'AI bot rules',
  description: 'Requires robots.txt rules naming known AI crawlers.',
  reference: 'https://www.rfc-editor.org/rfc/rfc9309',
  extraGroups: ['privacy'],
});
