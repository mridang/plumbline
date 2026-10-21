import { agentHint } from './define-agent-hint.js';

/**
 * isitagentready.com check. Bot access control (not scored): lets bots prove identity with HTTP message signatures.
 * The logic lives in `src/lib/agent`; failures are reported as advice.
 */
export default agentHint({
  id: 'agent-web-bot-auth',
  name: 'Web Bot Auth directory',
  description:
    'Requires a key directory at /.well-known/http-message-signatures-directory.',
  reference:
    'https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/',
  extraGroups: ['security-headers'],
});
