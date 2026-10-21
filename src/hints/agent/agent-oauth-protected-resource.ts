import { agentHint } from './define-agent-hint.js';

/**
 * isitagentready.com check. Discovery: RFC 9728 tells agents which authorization servers protect this resource.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-oauth-protected-resource',
  name: 'OAuth protected resource metadata',
  description:
    'Requires /.well-known/oauth-protected-resource with a resource on this site.',
  reference: 'https://www.rfc-editor.org/rfc/rfc9728',
});
