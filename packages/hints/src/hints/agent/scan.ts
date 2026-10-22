import type { HintContext } from 'hint';
import { dns } from '../../core/dns.js';
import type { Site } from '../../core/page.js';
import { CHECKS, checkById, runCheck } from '../../lib/agent/checks.js';
import { detectCommerceSignals } from '../../lib/agent/commerce.js';
import type { AgentEnv, CheckResult, Probe } from '../../lib/agent/types.js';

/** What is shared by every agent hint during one scan. */
interface ScanState {
  env: AgentEnv;
  results: Map<string, Promise<CheckResult>>;
}

/**
 * One state per scan, keyed by the engine, so a probe (for example
 * `/robots.txt`) is fetched once even though many hints and the score hint
 * all read it.
 */
const scans = new WeakMap<object, ScanState>();

function toProbe(
  data: Awaited<ReturnType<Site['fetch']>>,
  url: string,
): Probe | null {
  if (!data) return null;
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(data.response.headers)) {
    headers[name.toLowerCase()] = Array.isArray(value)
      ? value.join(', ')
      : String(value);
  }
  return {
    url,
    status: data.response.statusCode,
    headers,
    contentType: headers['content-type'] ?? '',
    body: data.response.body.content,
  };
}

function createState(context: HintContext, site: Site): ScanState {
  const cache = new Map<string, Promise<Probe | null>>();
  const env: AgentEnv = {
    origin: site.origin,
    host: site.url.hostname,
    probe(path, headers = {}) {
      const key = `${path}\n${JSON.stringify(headers)}`;
      let pending = cache.get(key);
      if (!pending) {
        pending = site
          .fetch(path, headers)
          .then((data) => toProbe(data, new URL(path, site.url).href));
        cache.set(key, pending);
      }
      return pending;
    },
    // Read `dns.client` at call time so a test can swap in a fake.
    dns: { query: (name, type) => dns.client.query(name, type) },
    evaluate: (code) => context.evaluate(code),
  };
  return { env, results: new Map() };
}

function stateFor(context: HintContext, site: Site): ScanState {
  let state = scans.get(context.engineKey);
  if (!state) {
    state = createState(context, site);
    scans.set(context.engineKey, state);
  }
  return state;
}

/** Runs (once per scan) the check with the given hint id. */
export function resultFor(
  context: HintContext,
  site: Site,
  id: string,
): Promise<CheckResult> {
  const state = stateFor(context, site);
  let pending = state.results.get(id);
  if (!pending) {
    pending = runCheck(checkById(id), state.env);
    state.results.set(id, pending);
  }
  return pending;
}

/** Runs every check and says whether the site looks like a shop. */
export async function allResults(
  context: HintContext,
  site: Site,
): Promise<{ results: CheckResult[]; commerceDetected: boolean }> {
  const results = await Promise.all(
    CHECKS.map((check) => resultFor(context, site, check.id)),
  );
  const commerceDetected = await detectCommerceSignals(
    stateFor(context, site).env,
    results,
  );
  return { results, commerceDetected };
}
