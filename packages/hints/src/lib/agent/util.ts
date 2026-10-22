import type {
  AgentCategory,
  AgentEnv,
  CheckResult,
  Evidence,
  Probe,
} from './types.js';

/** Builds a check result. */
export function result(
  id: string,
  category: AgentCategory,
  passed: boolean,
  detail: string,
  evidence?: Evidence,
): CheckResult {
  return { id, category, passed, detail, ...(evidence ? { evidence } : {}) };
}

/** The absolute URL of a path on the scanned site. */
export function urlOf(env: AgentEnv, path: string): string {
  return new URL(path, env.origin).href;
}

/** Evidence for a document that may or may not have been fetched. */
export function evidenceFor(
  env: AgentEnv,
  path: string,
  probe: Probe | null,
  snippet: string,
  language?: Evidence['language'],
): Evidence {
  return {
    resource: probe?.url ?? urlOf(env, path),
    snippet,
    ...(language ? { language } : {}),
  };
}

/** Pretty prints a value as a snippet, cut to `max` characters. */
export function pretty(value: unknown, max = 800): string {
  const text = JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n...` : text;
}

/** True for a plain object (not null, not an array). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True for a non-empty string. */
export function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** True when the probe is a `200 OK` response. */
export function isOk(probe: Probe | null): probe is Probe {
  return probe !== null && probe.status === 200;
}

/** True when the response claims to be an HTML page (a soft 404, usually). */
export function isHtml(probe: Probe): boolean {
  return /html/i.test(probe.contentType);
}

/** Parses the body as JSON; undefined when it is not valid JSON. */
function parseJson(probe: Probe | null): unknown {
  // Only a 200 answer is a document: the body of a 404 (often a JSON
  // error) or of an HTML soft 404 must never be interpreted.
  if (!isOk(probe) || isHtml(probe)) {
    return undefined;
  }
  try {
    return JSON.parse(probe.body) as unknown;
  } catch {
    return undefined;
  }
}

/** Parses the body as a JSON object; undefined for anything else. */
export function parseJsonObject(
  probe: Probe | null,
): Record<string, unknown> | undefined {
  const value = parseJson(probe);
  return isRecord(value) ? value : undefined;
}

/** Fetches the first path that answers `200` with a JSON object. */
export async function firstJson(
  paths: readonly string[],
  probe: (path: string) => Promise<Probe | null>,
): Promise<{ path: string; json: Record<string, unknown> } | undefined> {
  for (const path of paths) {
    const json = parseJsonObject(await probe(path));
    if (json) {
      return { path, json };
    }
  }
  return undefined;
}

/** Strips a leading `www.` and lower-cases a host name. */
export function bareHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

/** True for host names that are only reachable locally (dev servers). */
export function isLoopback(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/** Why a probe is not a usable document, in the scanner's words. */
export function missingReason(path: string, probe: Probe | null): string {
  if (probe === null) {
    return `${path} was not found (no response)`;
  }
  if (probe.status !== 200) {
    return `${path} was not found (HTTP ${probe.status})`;
  }
  if (isHtml(probe)) {
    return `${path} was not found (HTML page instead of a document)`;
  }
  return `${path} is not a JSON object`;
}

/** Probes each path again (cached) and explains why none was usable. */
export async function notFound(
  paths: readonly string[],
  probe: (path: string) => Promise<Probe | null>,
): Promise<string> {
  const reasons: string[] = [];
  for (const path of paths) {
    reasons.push(missingReason(path, await probe(path)));
  }
  return `${reasons.join('; ')}.`;
}
