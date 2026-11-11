import { agentHint } from './define-agent-hint.js';

/**
 * Isitagentready.com check. Discovery: agents learn how to authenticate from /.well-known/openid-configuration or oauth-authorization-server.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-oauth-discovery',
  name: 'OAuth discovery',
  description:
    'Requires OIDC or RFC 8414 authorization server metadata with a valid issuer.',
  reference: 'https://www.rfc-editor.org/rfc/rfc8414',
});
