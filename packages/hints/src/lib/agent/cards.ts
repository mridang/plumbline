import {
  firstJson,
  isRecord,
  isText,
  notFound,
  parseJsonObject,
  pretty,
  result,
  urlOf,
} from './utility.js';
import type { AgentEnv, CheckResult } from './types.js';

/** Matches a valid skill name: lower-case letters, digits and single hyphens. */
const SKILL_NAME_FORMAT = /^(?!-)(?!.*--)[a-z0-9-]{1,64}(?<!-)$/u;

/** Matches a `sha256:` digest followed by 64 hexadecimal digits. */
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/u;

/**
 * Paths where an MCP server card may live. UNVERIFIED: SEP-1649 (draft)
 * named `/.well-known/mcp/server-card.json`; the merged SEP-2127 and the
 * experimental-ext-server-card repo do not recommend a well-known path for
 * cards (they use `<streamable-http-url>/server-card` and an AI Catalog for
 * domain level discovery). The paths are kept because isitagentready.com
 * probes them; the AI catalog route below follows SEP-2127.
 */
const MCP_CARD_PATHS: readonly string[] = [
  '/.well-known/mcp/server-card.json',
  '/.well-known/mcp/server-cards.json',
  '/.well-known/mcp.json',
];

const A2A_PATHS = ['/.well-known/agent-card.json', '/.well-known/agent.json'];
const SKILLS_PATHS = [
  '/.well-known/agent-skills/index.json',
  '/.well-known/skills/index.json',
];

/** Media type of an MCP server card in an AI catalog (SEP-2127). */
export const MCP_CARD_TYPE = 'application/mcp-server-card+json';

/** AI catalog locations (ARD `ard.json`, and its predecessor). */
const CATALOG_PATHS = ['/.well-known/ard.json', '/.well-known/ai-catalog.json'];

/** Finds the transport endpoint of a server card, in any known shape. */
function mcpEndpoint(card: Record<string, unknown>): string | undefined {
  const { transport, endpoint, remotes } = card;
  // SEP-2127: `remotes` lists the transport endpoints.
  if (
    Array.isArray(remotes) &&
    isRecord(remotes[0]) &&
    isText(remotes[0].url)
  ) {
    return remotes[0].url;
  }
  // SEP-1649 draft: `transport: { type, endpoint }`.
  if (isRecord(transport)) {
    const nested = ['endpoint', 'url']
      .map((key) => transport[key])
      .find(isText);
    if (nested !== undefined) {
      return nested;
    }
  }
  return isText(endpoint) ? endpoint : undefined;
}

/**
 * The name and version of a card: SEP-2127 puts them at the top level,
 * the SEP-1649 draft in `serverInfo`.
 */
function mcpIdentity(
  card: Record<string, unknown>,
): { name: string; version: string } | undefined {
  const source = isRecord(card.serverInfo) ? card.serverInfo : card;
  return isText(source.name) && isText(source.version)
    ? { name: source.name, version: source.version }
    : undefined;
}

/** Collects the cards of a document: a single card or a list of them. */
function cardsOf(root: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(root.servers)) {
    return root.servers.filter(isRecord);
  }
  if (Array.isArray(root.cards)) {
    return root.cards.filter(isRecord);
  }
  return [root].filter(isRecord);
}

/** Finds the first valid card in a document; returns a description. */
function validCard(root: Record<string, unknown>): string | undefined {
  return cardsOf(root).flatMap((card) => {
    const identity = mcpIdentity(card);
    const endpoint = mcpEndpoint(card);
    return identity && endpoint ? [`${identity.name} at ${endpoint}`] : [];
  })[0];
}

/**
 * MCP Server Card (SEP-2127, earlier SEP-1649): a card with a name, a
 * version and a transport endpoint (`remotes[].url`, or the draft's
 * `transport.endpoint`), found at a well-known path or through an AI
 * catalog entry of type `application/mcp-server-card+json` (inline `data`
 * or a `url`).
 */
export async function checkMcpServerCard(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-mcp-server-card';
  const found = await firstJson(MCP_CARD_PATHS, async (path) =>
    env.probe(path),
  );
  if (found) {
    const card = validCard(found.json);
    return card
      ? result(id, 'discovery', true, `${found.path} describes ${card}.`)
      : result(
          id,
          'discovery',
          false,
          `${found.path} needs a name, a version and a transport endpoint.`,
          { resource: urlOf(env, found.path), snippet: pretty(found.json) },
        );
  }
  // SEP-2127: a catalog entry points to (or embeds) the card.
  // eslint-disable-next-line functional/no-loop-statements -- probes the catalogs in order and stops at the first valid card
  for (const path of CATALOG_PATHS) {
    const catalog = parseJsonObject(await env.probe(path));
    const entries = Array.isArray(catalog?.entries) ? catalog.entries : [];
    // eslint-disable-next-line functional/no-loop-statements -- reads the entries in order and stops at the first valid card
    for (const entry of entries) {
      if (!isRecord(entry) || entry.type !== MCP_CARD_TYPE) {
        continue;
      }
      // Without embedded data or a url there is no card to check.
      const embedded = isRecord(entry.data) ? entry.data : undefined;
      const linked =
        embedded === undefined && isText(entry.url)
          ? parseJsonObject(await env.probe(entry.url))
          : undefined;
      const parsedDocument = embedded ?? linked;
      const card = parsedDocument && validCard(parsedDocument);
      if (card) {
        return result(id, 'discovery', true, `${path} lists ${card}.`);
      }
    }
  }
  return result(
    id,
    'discovery',
    false,
    await notFound(MCP_CARD_PATHS, async (path) => env.probe(path)),
    {
      resource: urlOf(env, MCP_CARD_PATHS[0]),
      snippet: pretty({
        name: env.host,
        version: '1.0.0',
        remotes: [{ type: 'streamable-http', url: `${env.origin}/mcp` }],
      }),
    },
  );
}

/**
 * A2A Agent Card (A2A specification 1.0, section 4.4.1): served at
 * `/.well-known/agent-card.json` (section 8.2) with `name`, `description`,
 * `version`, `capabilities`, `defaultInputModes`, `defaultOutputModes`,
 * `skills` and `supportedInterfaces` (each with `url`, `protocolBinding`
 * and `protocolVersion`). UNVERIFIED against the spec: the pre-1.0 shape
 * (a top-level `url` instead of `supportedInterfaces`) and the legacy
 * `/.well-known/agent.json` path are still accepted, because isitagentready.com
 * and older agents use them.
 */
export async function checkA2aAgentCard(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-a2a-agent-card';
  const found = await firstJson(A2A_PATHS, async (path) => env.probe(path));
  if (!found) {
    return result(
      id,
      'discovery',
      false,
      await notFound(A2A_PATHS, async (path) => env.probe(path)),
      {
        resource: urlOf(env, A2A_PATHS[0]),
        snippet: pretty({
          name: env.host,
          description: 'What the agent does',
          version: '1.0.0',
          capabilities: {},
          defaultInputModes: ['text/plain'],
          defaultOutputModes: ['text/plain'],
          skills: [],
          supportedInterfaces: [
            {
              url: `${env.origin}/a2a`,
              protocolBinding: 'JSONRPC',
              protocolVersion: '1.0',
            },
          ],
        }),
      },
    );
  }
  const card = found.json;
  const interfaces = card.supportedInterfaces;
  const hasInterfaceList = Array.isArray(interfaces);
  const interfacesComplete =
    hasInterfaceList &&
    interfaces.length > 0 &&
    interfaces.every(
      (entry) =>
        isRecord(entry) &&
        isText(entry.url) &&
        isText(entry.protocolBinding) &&
        isText(entry.protocolVersion),
    );
  // A card that names its url directly needs no supportedInterfaces list.
  const missing = [
    ...['name', 'description', 'version'].filter((key) => !isText(card[key])),
    ...(isRecord(card.capabilities) ? [] : ['capabilities']),
    ...['defaultInputModes', 'defaultOutputModes', 'skills'].filter(
      (key) => !Array.isArray(card[key]),
    ),
    ...(hasInterfaceList && !interfacesComplete
      ? ['supportedInterfaces (url, protocolBinding, protocolVersion)']
      : []),
    ...(!hasInterfaceList && !isText(card.url) ? ['supportedInterfaces'] : []),
  ];
  return missing.length === 0
    ? result(
        id,
        'discovery',
        true,
        `${found.path} describes agent ${String(card.name)}.`,
      )
    : result(
        id,
        'discovery',
        false,
        `${found.path} is missing ${missing.join(', ')}.`,
        { resource: urlOf(env, found.path), snippet: pretty(card) },
      );
}

/** The schema URI of the Agent Skills discovery index, version 0.2.0. */
export const SKILLS_SCHEMA =
  'https://schemas.agentskills.io/discovery/0.2.0/schema.json';

/** Returns the problems of one skill entry (agent-skills-discovery-rfc). */
export function skillProblems(skill: unknown): string[] {
  if (!isRecord(skill)) {
    return ['is not an object'];
  }
  return [
    ...(!isText(skill.name) || !SKILL_NAME_FORMAT.test(skill.name)
      ? ['name must be 1-64 lowercase letters, digits and single hyphens']
      : []),
    ...(skill.type === 'skill-md' || skill.type === 'archive'
      ? []
      : ['type must be skill-md or archive']),
    ...(!isText(skill.description) || skill.description.length > 1024
      ? ['description must be 1-1024 characters']
      : []),
    ...(isText(skill.url) ? [] : ['url is missing']),
    ...(!isText(skill.digest) || !SHA256_DIGEST.test(skill.digest)
      ? ['digest must be sha256:<64 lowercase hex>']
      : []),
  ];
}

/**
 * Agent Skills discovery (Cloudflare agent-skills-discovery-rfc, v0.2.0):
 * `/.well-known/agent-skills/index.json` has a `skills` array and a
 * `$schema` (an index without one is read as v0.1.0; an unknown one is
 * refused). Each skill needs name, type, description, url and digest.
 * UNVERIFIED: the `/.well-known/skills/index.json` fallback comes from
 * isitagentready.com, not from the RFC.
 */
export async function checkSkills(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-skills';
  const found = await firstJson(SKILLS_PATHS, async (path) => env.probe(path));
  if (!found) {
    return result(
      id,
      'discovery',
      false,
      await notFound(SKILLS_PATHS, async (path) => env.probe(path)),
      {
        resource: urlOf(env, SKILLS_PATHS[0]),
        snippet: pretty({
          $schema: SKILLS_SCHEMA,
          skills: [
            {
              name: 'example',
              type: 'skill-md',
              description: 'What the skill does',
              url: `${env.origin}/.well-known/agent-skills/example/SKILL.md`,
              digest: `sha256:${'0'.repeat(64)}`,
            },
          ],
        }),
      },
    );
  }
  const { $schema: schema } = found.json;
  if (schema !== undefined && schema !== SKILLS_SCHEMA) {
    return result(
      id,
      'discovery',
      false,
      `${found.path} has an unrecognised $schema.`,
      {
        resource: urlOf(env, found.path),
        snippet: `"$schema": ${JSON.stringify(schema)}`,
      },
    );
  }
  const skills = Array.isArray(found.json.skills) ? found.json.skills : [];
  if (skills.length === 0) {
    return result(id, 'discovery', false, `${found.path} lists no skills.`, {
      resource: urlOf(env, found.path),
      snippet: pretty(found.json),
    });
  }
  const bad = skills.filter((skill) => skillProblems(skill).length > 0);
  return bad.length === 0
    ? result(
        id,
        'discovery',
        true,
        `${found.path} lists ${skills.length} skill(s).`,
      )
    : result(
        id,
        'discovery',
        false,
        `${bad.length} skill(s) are invalid: ${skillProblems(bad[0]).join('; ')}.`,
        { resource: urlOf(env, found.path), snippet: pretty(bad[0]) },
      );
}
