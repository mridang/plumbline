import { agentHint } from './define-agent-hint.js';

/**
 * isitagentready.com check. Discovery: a single document listing the site's APIs and their descriptions.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-api-catalog',
  name: 'API catalog',
  description: 'Requires an RFC 9727 linkset at /.well-known/api-catalog.',
  reference: 'https://www.rfc-editor.org/rfc/rfc9727',
});
