import type { AgentEnv, CheckResult } from './types.js';
import {
  bareHost,
  isLoopback,
  isRecord,
  isText,
  missingReason,
  parseJsonObject,
  result,
} from './util.js';

/**
 * Personal Agent Protocol (Poppy): `/.well-known/poppy.json` over HTTPS
 * (plain HTTP is accepted for local development hosts) with
 * `protocol_version` "0.1" (what isitagentready.com checks; the
 * protocol site's example uses "0.2", so both are accepted), an organization whose domain is this host, and
 * at least one of `agent`, `apis` or `web`. When `auth.issuer` is given it
 * must equal the `issuer` of that server's RFC 8414 metadata, whose
 * `poppy_domains` must include the organization's domain.
 */
export async function checkPoppy(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-poppy';
  const fail = (detail: string) => result(id, 'discovery', false, detail);
  const probe = await env.probe('/.well-known/poppy.json');
  const doc = parseJsonObject(probe);
  if (!doc) return fail(`${missingReason('/.well-known/poppy.json', probe)}.`);
  if (!env.origin.startsWith('https://') && !isLoopback(env.host)) {
    return fail('poppy.json must be served over HTTPS.');
  }
  if (doc.protocol_version !== '0.1' && doc.protocol_version !== '0.2') {
    return fail('protocol_version must be "0.1" or "0.2".');
  }
  const org = doc.organization;
  if (!isRecord(org) || !isText(org.name) || !isText(org.domain)) {
    return fail('organization needs a name and a domain.');
  }
  if (bareHost(org.domain) !== bareHost(env.host)) {
    return fail(
      `organization.domain ${org.domain} does not match ${env.host}.`,
    );
  }
  if (!['agent', 'apis', 'web'].some((key) => key in doc)) {
    return fail('One of agent, apis or web is required.');
  }
  const auth = doc.auth;
  if (isRecord(auth) && isText(auth.issuer)) {
    const base = auth.issuer.replace(/\/+$/, '');
    const meta = parseJsonObject(
      await env.probe(`${base}/.well-known/oauth-authorization-server`),
    );
    if (!meta || meta.issuer !== auth.issuer) {
      return fail('auth.issuer does not match the RFC 8414 metadata issuer.');
    }
    // personalagentprotocol.org: the issuer metadata must also list the
    // organization's domain in `poppy_domains`.
    const domains = Array.isArray(meta.poppy_domains) ? meta.poppy_domains : [];
    if (!domains.includes(org.domain)) {
      return fail(
        'poppy_domains of the issuer metadata lacks the organization domain.',
      );
    }
  }
  return result(id, 'discovery', true, `poppy.json describes ${org.name}.`);
}
