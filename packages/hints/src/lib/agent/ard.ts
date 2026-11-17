import { loadRobots } from './robots.js';
import {
  isRecord,
  isText,
  notFound,
  parseJsonObject,
  pretty,
  result,
  urlOf,
} from './utility.js';
import type { AgentEnv, CheckResult } from './types.js';

/** Matches a well-formed `urn:air:` identifier. */
const URN_AIR_IDENTIFIER = /^urn:air:(?=[^:]+\.[^:])[^:]+:[^:]+(:[^:]+)*$/u;

/** Matches a `<link>` tag whose `rel` is `ard` or `ai-catalog`. */
const ARD_LINK_TAG = /<link\b[^>]*\brel=["']?(?:ard|ai-catalog)["']?[^>]*>/iu;

/** Matches an `href` attribute and captures its value. */
const HREF_ATTRIBUTE = /\bhref=["']?([^"'\s>]+)/iu;

/** Matches an HTTP or HTTPS URL inside text. */
const HTTP_URL = /https?:\/\/[^\s"';]+/u;

/**
 * Where a catalog lives: `/.well-known/ard.json` (agenticresourcediscovery.org
 * spec) and its predecessor `/.well-known/ai-catalog.json`, which
 * isitagentready.com probes.
 */
const CATALOG_PATHS = ['/.well-known/ard.json', '/.well-known/ai-catalog.json'];

/** Media type: `type/subtype` (the spec says an IANA media type). */
const MEDIA_TYPE = /^[\w.+-]+\/[\w.+-]+(;.*)?$/u;

/**
 * Returns the problems of one catalog entry; empty when it is valid. An
 * entry needs `identifier` (`urn:air:<publisher fqdn>:[<ns>:]<name>`;
 * the older `id` is accepted), `displayName`, `type` and exactly one of
 * `url` or `data`. `representativeQueries` should hold 2-5 examples but the
 * spec only warns about that, so it is not a failure.
 */
export function entryProblems(entry: unknown): string[] {
  if (!isRecord(entry)) {
    return ['entry is not an object'];
  }
  const identifier = entry.identifier ?? entry.id;
  return [
    ...(!isText(identifier) || !URN_AIR_IDENTIFIER.test(identifier)
      ? ['identifier must be urn:air:<publisher domain>:[<ns>:]<name>']
      : []),
    ...(isText(entry.displayName) ? [] : ['displayName is missing']),
    ...(!isText(entry.type) || !MEDIA_TYPE.test(entry.type)
      ? ['type must be a media type']
      : []),
    ...('url' in entry === 'data' in entry
      ? ['exactly one of url and data is required']
      : []),
  ];
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
  const legacyProblems = legacy
    ? [
        ...(isText(catalog.specVersion) ? [] : ['specVersion is missing']),
        ...(isRecord(catalog.host) ? [] : ['host is missing']),
      ]
    : [];
  const entries = catalog.entries;
  const entryProblemList =
    !Array.isArray(entries) || entries.length === 0
      ? ['entries is empty']
      : entries.flatMap((entry, index) =>
          entryProblems(entry).map((problem) => `entry ${index}: ${problem}`),
        );
  return [...legacyProblems, ...entryProblemList];
}

/** Collects the places a catalog may be advertised, best first. */
async function candidates(env: AgentEnv): Promise<string[]> {
  const robots = await loadRobots(env);
  const home = await env.probe('/');
  const link = ARD_LINK_TAG.exec(home?.body ?? '');
  const href = link && HREF_ATTRIBUTE.exec(link[0]);
  // No DNS answer: nothing to add.
  const fromDns = await env.dns
    .query(`_catalog._agents.${env.host}`, 'TXT')
    .then((txt) =>
      txt.answers.flatMap((answer) => {
        const url = HTTP_URL.exec(answer.data);
        return url ? [url[0]] : [];
      }),
    )
    .catch(() => []);
  return [
    ...new Set(
      [
        CATALOG_PATHS,
        robots?.agentmaps ?? [],
        href ? [href[1]] : [],
        fromDns,
      ].flat(),
    ),
  ];
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
  // eslint-disable-next-line functional/no-let -- remembers the problems of the last catalog that parsed, for the failure message
  let lastProblems: string[] = [];
  // eslint-disable-next-line functional/no-let -- remembers the last catalog that parsed, for the failure evidence
  let invalid: { url: string; catalog: Record<string, unknown> } | undefined;
  const urls = await candidates(env);
  // eslint-disable-next-line functional/no-loop-statements -- probes the candidates in order and stops at the first valid catalog
  for (const url of urls) {
    const catalog = parseJsonObject(await env.probe(url));
    if (!catalog) {
      continue;
    }
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
      : await notFound(urls.slice(0, 2), async (url) => env.probe(url)),
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
