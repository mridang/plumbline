import type { AgentEnv, CheckResult } from './types.js';
import {
  isRecord,
  isText,
  missingReason,
  parseJsonObject,
  pretty,
  result,
  urlOf,
} from './util.js';

/**
 * API Catalog (RFC 9727): `/.well-known/api-catalog`, asked for as
 * `application/linkset+json`, is a linkset whose entries have an `anchor`
 * and a `service-desc`, `service-doc` or `status` link.
 */
export async function checkApiCatalog(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-api-catalog';
  const path = '/.well-known/api-catalog';
  const probe = await env.probe(path, { accept: 'application/linkset+json' });
  const json = parseJsonObject(probe);
  if (!json) {
    return result(id, 'discovery', false, `${missingReason(path, probe)}.`, {
      resource: probe?.url ?? urlOf(env, path),
      snippet: pretty({
        linkset: [
          {
            anchor: `${env.origin}/api`,
            'service-desc': [
              { href: `${env.origin}/openapi.json`, type: 'application/json' },
            ],
          },
        ],
      }),
    });
  }
  const linkset = Array.isArray(json.linkset) ? json.linkset : [];
  const valid = linkset.filter(
    (entry) =>
      isRecord(entry) &&
      isText(entry.anchor) &&
      ['service-desc', 'service-doc', 'service-meta', 'status', 'item'].some(
        (rel) => Array.isArray(entry[rel]),
      ),
  );
  return valid.length > 0
    ? result(
        id,
        'discovery',
        true,
        `The API catalog lists ${valid.length} API(s).`,
      )
    : result(
        id,
        'discovery',
        false,
        'The linkset has no entry with an anchor and service-desc, service-doc or status.',
        { resource: probe?.url ?? urlOf(env, path), snippet: pretty(json) },
      );
}
