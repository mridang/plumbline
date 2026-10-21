import type { AgentEnv, CheckResult } from './types.js';
import {
  isHtml,
  isOk,
  missingReason,
  parseJsonObject,
  result,
} from './util.js';

/**
 * UNVERIFIED: the well-known path and the `keys` check come from
 * isitagentready.com; the IETF draft (draft-meunier-webbotauth-httpsig-
 * directory) only fixes a JWKS based directory format.
 *
 * Web Bot Auth: `/.well-known/http-message-signatures-directory` answers 200
 * with a key directory (a JWKS) so sites can verify signed bot requests.
 */
export async function checkWebBotAuth(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-web-bot-auth';
  const probe = await env.probe(
    '/.well-known/http-message-signatures-directory',
  );
  if (!isOk(probe) || isHtml(probe)) {
    return result(
      id,
      'bot-access',
      false,
      `${missingReason('/.well-known/http-message-signatures-directory', probe)}.`,
    );
  }
  const keys = parseJsonObject(probe)?.keys;
  return Array.isArray(keys) && keys.length > 0
    ? result(
        id,
        'bot-access',
        true,
        `The key directory lists ${keys.length} key(s).`,
      )
    : result(id, 'bot-access', false, 'The key directory has no keys.');
}
