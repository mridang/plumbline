/**
 * The audit registry: the single declarative table the plugin is built from.
 * Each per-set file exports an array of {@link AuditCheck}; this module
 * concatenates them and exposes the whole table plus a lookup used by the thin
 * per-audit wrapper modules under `../audits/`.
 *
 * Only the `headers` set is implemented; the other sets are stubs a later wave
 * fills in. Adding a check means adding it to the owning set's array here and
 * creating its one-line wrapper module `../audits/<id>.ts`.
 */
import { makeAudit } from '../audit-factory.js';
import type { Audit } from 'lighthouse';
import type { AuditCheck } from './types.js';
import { headersChecks } from './headers.js';
import { opengraphChecks } from './opengraph.js';
import { seoChecks } from './seo.js';
import { technicalChecks } from './technical.js';
import { geoChecks } from './geo.js';
import { privacyChecks } from './privacy.js';
import { agentChecks } from './agent.js';
import { i18nChecks } from './i18n.js';
import { richresultsChecks } from './richresults.js';
import { feedsChecks } from './feeds.js';
import { pwaChecks } from './pwa.js';
import { secplusChecks } from './secplus.js';
import { headersxChecks } from './headersx.js';

/** Every check across every set, in set order. */
export const checks: readonly AuditCheck[] = [
  ...headersChecks,
  ...opengraphChecks,
  ...seoChecks,
  ...technicalChecks,
  ...geoChecks,
  ...privacyChecks,
  ...agentChecks,
  ...i18nChecks,
  ...richresultsChecks,
  ...feedsChecks,
  ...pwaChecks,
  ...secplusChecks,
  ...headersxChecks,
];

/** Checks indexed by id, for the per-audit wrapper modules. */
const byId = new Map(checks.map((check) => [check.id, check]));

/**
 * Returns the `Audit` subclass for a check id. The thin wrapper module each
 * audit is loaded from (a Lighthouse plugin can only reference audits by path)
 * calls this with its own id.
 */
export function auditById(id: string): typeof Audit {
  const check = byId.get(id);
  if (!check) {
    throw new Error(`No audit check registered for id '${id}'.`);
  }
  return makeAudit(check);
}
