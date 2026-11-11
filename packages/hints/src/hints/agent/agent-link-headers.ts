import { agentHint } from './define-agent-hint.js';

/**
 * Isitagentready.com check. Discoverability: RFC 8288 Link headers (with RFC 9727 relations) point agents at API descriptions without parsing HTML.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-link-headers',
  name: 'Agent Link headers',
  description:
    'Requires a Link header with an agent-useful relation such as api-catalog or service-desc.',
  reference:
    'https://www.iana.org/assignments/link-relations/link-relations.xhtml',
});
