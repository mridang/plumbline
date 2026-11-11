import { agentHint } from './define-agent-hint.js';

/**
 * Isitagentready.com check. Discoverability: agents read /robots.txt first to learn what they may crawl (RFC 9309).
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-robots-txt',
  name: 'robots.txt for agents',
  description:
    'Requires a text/plain /robots.txt with at least one User-agent directive.',
  reference: 'https://www.rfc-editor.org/rfc/rfc9309',
});
