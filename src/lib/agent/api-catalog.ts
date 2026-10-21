import type { AgentEnv, CheckResult } from './types.js';
import { isRecord, isText, parseJsonObject, result } from './util.js';

/**
 * API Catalog (RFC 9727): `/.well-known/api-catalog`, asked for as
 * `application/linkset+json`, is a linkset whose entries have an `anchor`
 * and a `service-desc`, `service-doc` or `status` link.
 */
export async function checkApiCatalog(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-api-catalog';
  const json = parseJsonObject(
    await env.probe('/.well-known/api-catalog', {
      accept: 'application/linkset+json',
    }),
  );
  if (!json) {
    return result(id, 'discovery', false, 'No API catalog was found.');
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
      );
}
