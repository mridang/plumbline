import type { AgentCategory, CheckResult, Probe } from './types.js';

/** Builds a check result. */
export function result(
  id: string,
  category: AgentCategory,
  passed: boolean,
  detail: string,
): CheckResult {
  return { id, category, passed, detail };
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
  if (!probe) {
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
