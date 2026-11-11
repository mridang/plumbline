import { agentHint } from './define-agent-hint.js';

/**
 * Isitagentready.com check. Discoverability: ServiceMode SVCB/HTTPS records (RFC 9460) at _index/_a2a/_mcp._agents tell agents where endpoints live.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-dns-aid',
  name: 'DNS for AI discovery',
  description:
    'Requires SVCB or HTTPS records under _agents of the host (DNS-AID).',
  reference:
    'https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/',
  extraGroups: ['dns'],
});
