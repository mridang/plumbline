import { loadRobots } from './robots.js';
import type { AgentEnv, CheckResult } from './types.js';
import {
  isRecord,
  isText,
  notFound,
  parseJsonObject,
  pretty,
  result,
  urlOf,
} from './util.js';

/**
 * Where a catalog lives: `/.well-known/ard.json` (agenticresourcediscovery.org
 * spec) and its predecessor `/.well-known/ai-catalog.json`, which
 * isitagentready.com probes.
 */
const CATALOG_PATHS = ['/.well-known/ard.json', '/.well-known/ai-catalog.json'];

/** Media type: `type/subtype` (the spec says an IANA media type). */
const MEDIA_TYPE = /^[\w.+-]+\/[\w.+-]+(;.*)?$/;

/**
 * Returns the problems of one catalog entry; empty when it is valid. An
 * entry needs `identifier` (`urn:air:<publisher fqdn>:[<ns>:]<name>`;
 * the older `id` is accepted), `displayName`, `type` and exactly one of
 * `url` or `data`. `representativeQueries` should hold 2-5 examples but the
 * spec only warns about that, so it is not a failure.
 */
export function entryProblems(entry: unknown): string[] {
  if (!isRecord(entry)) return ['entry is not an object'];
  const problems: string[] = [];
  const identifier = entry.identifier ?? entry.id;
  if (
    !isText(identifier) ||
    !/^urn:air:[^:]+\.[^:]+:([^:]+:)*[^:]+$/.test(identifier)
  ) {
    problems.push(
      'identifier must be urn:air:<publisher domain>:[<ns>:]<name>',
    );
  }
  if (!isText(entry.displayName)) problems.push('displayName is missing');
  if (!isText(entry.type) || !MEDIA_TYPE.test(entry.type)) {
    problems.push('type must be a media type');
  }
  if ('url' in entry === 'data' in entry) {
    problems.push('exactly one of url and data is required');
  }
  return problems;
}

/**
 * Validates a catalog document; returns its problems. Only `entries` is
 * required by the spec; the older ai-catalog format (`legacy`) also needs
 * `specVersion` and `host`.
 */
export function catalogProblems(
  catalog: Record<string, unknown>,
  legacy = false,
): string[] {
  const problems: string[] = [];
  if (legacy) {
    if (!isText(catalog.specVersion)) problems.push('specVersion is missing');
    if (!isRecord(catalog.host)) problems.push('host is missing');
  }
  const entries = catalog.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    problems.push('entries is empty');
  } else {
    entries.forEach((entry, index) => {
      for (const problem of entryProblems(entry)) {
        problems.push(`entry ${index}: ${problem}`);
      }
    });
  }
  return problems;
}

/** Collects the places a catalog may be advertised, best first. */
async function candidates(env: AgentEnv): Promise<string[]> {
  const urls = [...CATALOG_PATHS];
  const robots = await loadRobots(env);
  urls.push(...(robots?.agentmaps ?? []));
  const home = await env.probe('/');
  const link = /<link\b[^>]*\brel=["']?(?:ard|ai-catalog)["']?[^>]*>/i.exec(
    home?.body ?? '',
  );
  const href = link && /\bhref=["']?([^"'\s>]+)/i.exec(link[0]);
  if (href) urls.push(href[1]);
  try {
    const txt = await env.dns.query(`_catalog._agents.${env.host}`, 'TXT');
    for (const answer of txt.answers) {
      const url = /https?:\/\/[^\s"';]+/.exec(answer.data);
      if (url) urls.push(url[0]);
    }
  } catch {
    // No DNS answer: nothing to add.
  }
  return [...new Set(urls)];
}

/**
 * ARD (Agentic Resource Discovery): an AI catalog at
 * `/.well-known/ard.json` (or the older `ai-catalog.json`, or advertised by an `Agentmap` line or a
 * `<link rel="ard">`; UNVERIFIED: DNS TXT `_catalog._agents` comes from
 * isitagentready.com, the spec uses SVCB at `_entries._agents`, not resolved) with valid
 * entries.
 */
export async function checkArd(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-ard';
  let lastProblems: string[] = [];
  let invalid: { url: string; catalog: Record<string, unknown> } | undefined;
  const urls = await candidates(env);
  for (const url of urls) {
    const catalog = parseJsonObject(await env.probe(url));
    if (!catalog) continue;
    lastProblems = catalogProblems(catalog, url.endsWith('ai-catalog.json'));
    invalid = { url: urlOf(env, url), catalog };
    if (lastProblems.length === 0) {
      return result(id, 'discovery', true, `${url} is a valid AI catalog.`);
    }
  }
  return result(
    id,
    'discovery',
    false,
    lastProblems.length > 0
      ? `The AI catalog is invalid: ${lastProblems[0]}.`
      : await notFound(urls.slice(0, 2), (url) => env.probe(url)),
    invalid && lastProblems.length > 0
      ? { resource: invalid.url, snippet: pretty(invalid.catalog) }
      : {
          resource: urlOf(env, urls[0]),
          snippet: pretty({
            entries: [
              {
                identifier: `urn:air:${env.host}:example`,
                displayName: 'Example',
                type: 'application/mcp-server-card+json',
                url: `${env.origin}/.well-known/mcp/server-card.json`,
              },
            ],
          }),
        },
  );
}
