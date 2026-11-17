import { dns } from '../../core/dns.js';
import { CHECKS, checkById, runCheck } from '../../lib/agent/checks.js';
import { detectCommerceSignals } from '../../lib/agent/commerce.js';
import type { Site } from '../../core/page.js';
import type { HintContext } from 'hint';
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
  if (!data) {
    return null;
  }
  const headers: Record<string, string> = Object.fromEntries(
    Object.entries(data.response.headers).map(([name, value]) => [
      name.toLowerCase(),
      Array.isArray(value) ? value.join(', ') : String(value),
    ]),
  );
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
    async probe(path, headers = {}) {
      const key = `${path}\n${JSON.stringify(headers)}`;
      const cached = cache.get(key);
      if (cached) {
        return cached;
      }
      const pending = site
        .fetch(path, headers)
        .then((data) => toProbe(data, new URL(path, site.url).href));
      // eslint-disable-next-line functional/immutable-data -- the cache exists to remember each probe once per scan
      cache.set(key, pending);
      return pending;
    },
    // Read `dns.client` at call time so a test can swap in a fake.
    dns: { query: async (name, type) => dns.client.query(name, type) },
    evaluate: async (code) => {
      const result: unknown = await context.evaluate(code);
      return result;
    },
  };
  return { env, results: new Map<string, Promise<CheckResult>>() };
}

function stateFor(context: HintContext, site: Site): ScanState {
  const existing = scans.get(context.engineKey);
  if (existing) {
    return existing;
  }
  const state = createState(context, site);
  scans.set(context.engineKey, state);
  return state;
}

/** Runs (once per scan) the check with the given hint id. */
export async function resultFor(
  context: HintContext,
  site: Site,
  id: string,
): Promise<CheckResult> {
  const state = stateFor(context, site);
  const cached = state.results.get(id);
  if (cached) {
    return cached;
  }
  const pending = runCheck(checkById(id), state.env);
  // eslint-disable-next-line functional/immutable-data -- the results map exists to run each check once per scan
  state.results.set(id, pending);
  return pending;
}

/** Runs every check and says whether the site looks like a shop. */
export async function allResults(
  context: HintContext,
  site: Site,
): Promise<{ results: CheckResult[]; commerceDetected: boolean }> {
  const results = await Promise.all(
    CHECKS.map(async (check) => resultFor(context, site, check.id)),
  );
  const commerceDetected = await detectCommerceSignals(
    stateFor(context, site).env,
    results,
  );
  return { results, commerceDetected };
}
