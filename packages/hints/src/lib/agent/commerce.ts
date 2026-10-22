import type { AgentEnv, CheckResult } from './types.js';
import {
  isHtml,
  isOk,
  isRecord,
  isText,
  missingReason,
  parseJsonObject,
  pretty,
  result,
  urlOf,
} from './util.js';

/**
 * x402: one of `/`, `/api` or `/api/v1` answers HTTP 402 Payment Required
 * (the x402 protocol). Informational.
 */
export async function checkX402(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-x402';
  for (const path of ['/', '/api', '/api/v1']) {
    const probe = await env.probe(path);
    if (probe?.status === 402) {
      return result(
        id,
        'commerce',
        true,
        `${path} answers 402 Payment Required.`,
      );
    }
  }
  return result(
    id,
    'commerce',
    false,
    'No endpoint answers 402 Payment Required.',
    {
      resource: urlOf(env, '/api'),
      snippet: 'HTTP/1.1 402 Payment Required',
      language: 'http',
    },
  );
}

/**
 * MPP (Machine Payment Protocol): `/openapi.json` advertises payment
 * information with `x-payment-info`. Informational.
 */
export async function checkMpp(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-mpp';
  const probe = await env.probe('/openapi.json');
  if (
    isOk(probe) &&
    !isHtml(probe) &&
    probe.body.includes('"x-payment-info"')
  ) {
    return result(
      id,
      'commerce',
      true,
      '/openapi.json advertises x-payment-info.',
    );
  }
  // mpp.dev: a payable resource answers 402 with `WWW-Authenticate: Payment`.
  const home = await env.probe('/');
  if (
    home?.status === 402 &&
    /^payment\b/i.test(home.headers['www-authenticate'] ?? '')
  ) {
    return result(
      id,
      'commerce',
      true,
      'The home page challenges with WWW-Authenticate: Payment.',
    );
  }
  return result(
    id,
    'commerce',
    false,
    '/openapi.json does not advertise payment info.',
    {
      resource: probe?.url ?? urlOf(env, '/openapi.json'),
      snippet: 'HTTP/1.1 402 Payment Required\nWWW-Authenticate: Payment',
      language: 'http',
    },
  );
}

/**
 * UCP (Universal Commerce Protocol): `/.well-known/ucp` is a JSON profile
 * with a `ucp` object that names its version. Informational.
 */
export async function checkUcp(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-ucp';
  const probe = await env.probe('/.well-known/ucp');
  const profile = parseJsonObject(probe);
  const ucp = profile?.ucp;
  if (!isRecord(ucp)) {
    return result(
      id,
      'commerce',
      false,
      profile
        ? '/.well-known/ucp has no ucp object.'
        : `${missingReason('/.well-known/ucp', probe)}.`,
      {
        resource: probe?.url ?? urlOf(env, '/.well-known/ucp'),
        snippet: pretty(
          profile ?? {
            ucp: {
              version: '2026-01-11',
              services: {},
              payment_handlers: {},
            },
          },
        ),
      },
    );
  }
  // ucp.dev: version (YYYY-MM-DD), services and payment_handlers are
  // required, and the registries must exist even when empty.
  const missing: string[] = [];
  if (!isText(ucp.version) || !/^\d{4}-\d{2}-\d{2}$/.test(ucp.version))
    missing.push('version');
  if (!isRecord(ucp.services)) missing.push('services');
  if (!isRecord(ucp.payment_handlers)) missing.push('payment_handlers');
  return missing.length === 0
    ? result(
        id,
        'commerce',
        true,
        `/.well-known/ucp declares version ${String(ucp.version)}.`,
      )
    : result(
        id,
        'commerce',
        false,
        `The UCP profile needs ${missing.join(', ')}.`,
        {
          resource: probe?.url ?? urlOf(env, '/.well-known/ucp'),
          snippet: pretty(ucp),
        },
      );
}

/**
 * ACP (Agentic Commerce Protocol): `/.well-known/acp.json` is a discovery
 * document naming the protocol and its `api_base_url`. Informational.
 */
export async function checkAcp(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-acp';
  const probe = await env.probe('/.well-known/acp.json');
  const doc = parseJsonObject(probe);
  if (!doc) {
    return result(
      id,
      'commerce',
      false,
      `${missingReason('/.well-known/acp.json', probe)}.`,
      {
        resource: probe?.url ?? urlOf(env, '/.well-known/acp.json'),
        snippet: pretty({
          protocol: { name: 'acp', version: '1.0' },
          api_base_url: `${env.origin}/acp`,
          transports: ['rest'],
          capabilities: {},
        }),
      },
    );
  }
  // ACP discovery RFC: protocol {name "acp", version}, api_base_url,
  // transports (including "rest") and capabilities are all required.
  const missing: string[] = [];
  const protocol = doc.protocol;
  if (
    !isRecord(protocol) ||
    protocol.name !== 'acp' ||
    !isText(protocol.version)
  ) {
    missing.push('protocol (name acp, version)');
  }
  if (!isText(doc.api_base_url)) missing.push('api_base_url');
  if (!Array.isArray(doc.transports) || !doc.transports.includes('rest')) {
    missing.push('transports including rest');
  }
  if (!isRecord(doc.capabilities)) missing.push('capabilities');
  return missing.length === 0
    ? result(
        id,
        'commerce',
        true,
        `/.well-known/acp.json points at ${String(doc.api_base_url)}.`,
      )
    : result(
        id,
        'commerce',
        false,
        `The ACP document needs ${missing.join(', ')}.`,
        {
          resource: probe?.url ?? urlOf(env, '/.well-known/acp.json'),
          snippet: pretty(doc),
        },
      );
}

/**
 * True when the site looks like a shop: a commerce protocol answered, or the
 * home page shows storefront markers. Only then does Commerce count. An
 * `Offer` is not a marker: free apps publish one with a price of 0.
 */
export async function detectCommerceSignals(
  env: AgentEnv,
  results: readonly CheckResult[],
): Promise<boolean> {
  if (results.some((r) => r.category === 'commerce' && r.passed)) {
    return true;
  }
  const home = await env.probe('/');
  return /add to cart|add to basket|shopify|woocommerce|schema\.org\/Product|"@type"\s*:\s*"Product"/i.test(
    home?.body ?? '',
  );
}
