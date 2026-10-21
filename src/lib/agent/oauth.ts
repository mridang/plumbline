import type { AgentEnv, CheckResult } from './types.js';
import {
  bareHost,
  isHtml,
  isLoopback,
  isOk,
  isText,
  missingReason,
  parseJsonObject,
  result,
} from './util.js';

/**
 * True for an identifier URL as RFC 8414 (issuer) and RFC 9728 (resource)
 * define it: an `https` URL without fragment or query. Plain http is
 * accepted for local development hosts only.
 */
export function isIdentifierUrl(value: unknown): value is string {
  if (!isText(value)) {
    return false;
  }
  try {
    const url = new URL(value);
    const secure =
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && isLoopback(url.hostname));
    return secure && url.hash === '' && url.search === '';
  } catch {
    return false;
  }
}

/**
 * OAuth/OIDC discovery: `/.well-known/openid-configuration`, else
 * `/.well-known/oauth-authorization-server` (RFC 8414), is a JSON document
 * with a valid `issuer` URL.
 */
export async function checkOauthDiscovery(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-oauth-discovery';
  const paths = [
    '/.well-known/openid-configuration',
    '/.well-known/oauth-authorization-server',
  ];
  const reasons: string[] = [];
  // Either document is enough: report only when both fail.
  for (const path of paths) {
    const probe = await env.probe(path);
    const json = parseJsonObject(probe);
    if (json && isIdentifierUrl(json.issuer)) {
      return result(
        id,
        'discovery',
        true,
        `${path} names issuer ${json.issuer}.`,
      );
    }
    reasons.push(
      json ? `${path} has no valid issuer URL` : missingReason(path, probe),
    );
  }
  return result(id, 'discovery', false, `${reasons.join('; ')}.`);
}

/**
 * OAuth protected resource metadata (RFC 9728): the JSON at
 * `/.well-known/oauth-protected-resource` has a `resource` that is a URL on
 * this site.
 */
export async function checkOauthProtectedResource(
  env: AgentEnv,
): Promise<CheckResult> {
  const id = 'agent-oauth-protected-resource';
  let json = parseJsonObject(
    await env.probe('/.well-known/oauth-protected-resource'),
  );
  if (!json) {
    // RFC 9728 section 5: a 401 challenge names the metadata URL in the
    // `resource_metadata` parameter of WWW-Authenticate.
    const home = await env.probe('/');
    const url = /resource_metadata="([^"]+)"/i.exec(
      home?.headers['www-authenticate'] ?? '',
    );
    if (url) {
      json = parseJsonObject(await env.probe(url[1]));
    }
  }
  if (!json) {
    return result(
      id,
      'discovery',
      false,
      `${missingReason(
        '/.well-known/oauth-protected-resource',
        await env.probe('/.well-known/oauth-protected-resource'),
      )}.`,
    );
  }
  if (!isIdentifierUrl(json.resource)) {
    return result(
      id,
      'discovery',
      false,
      'The metadata has no valid resource URL.',
    );
  }
  const resource = new URL(json.resource);
  if (bareHost(resource.hostname) !== bareHost(env.host)) {
    return result(
      id,
      'discovery',
      false,
      `The resource ${json.resource} is not on ${env.host}.`,
    );
  }
  // isitagentready.com requires the metadata at the root well-known path to
  // describe the site itself. RFC 9728 section 3.1 puts the metadata of a
  // resource that has a path under that path, for example
  // /.well-known/oauth-protected-resource/api/mcp for /api/mcp.
  if (resource.pathname !== '/') {
    return result(
      id,
      'discovery',
      false,
      `The resource ${json.resource} does not match the site; metadata for a resource with a path belongs at /.well-known/oauth-protected-resource${resource.pathname}.`,
    );
  }
  return result(
    id,
    'discovery',
    true,
    `The metadata describes resource ${json.resource}.`,
  );
}

/**
 * Auth.md: `/auth.md` holds registration instructions for agents, or the
 * authorization server metadata has an `agent_auth` block.
 */
export async function checkAuthMd(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-auth-md';
  const doc = await env.probe('/auth.md');
  if (isOk(doc) && !isHtml(doc) && doc.body.trim().length > 0) {
    return result(id, 'discovery', true, '/auth.md exists.');
  }
  const meta = parseJsonObject(
    await env.probe('/.well-known/oauth-authorization-server'),
  );
  if (meta && 'agent_auth' in meta) {
    return result(
      id,
      'discovery',
      true,
      'The authorization server metadata has an agent_auth block.',
    );
  }
  return result(id, 'discovery', false, `${missingReason('/auth.md', doc)}.`);
}
