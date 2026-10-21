import type { AgentEnv, CheckResult } from './types.js';
import { evidenceFor, result } from './util.js';

/** One link of a `Link` header (RFC 8288). */
export interface WebLink {
  target: string;
  /** The relation types, lower-cased. */
  rels: string[];
}

/** Splits on commas that are outside `<...>` and quoted strings. */
function splitLinks(header: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inUri = false;
  let inQuote = false;
  for (const char of header) {
    if (char === '"' && !inUri) inQuote = !inQuote;
    else if (char === '<' && !inQuote) inUri = true;
    else if (char === '>' && !inQuote) inUri = false;
    if (char === ',' && !inUri && !inQuote) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

/** Parses a `Link` header value into its links. */
export function parseLinkHeader(header: string): WebLink[] {
  const links: WebLink[] = [];
  for (const part of splitLinks(header)) {
    const match = /^<([^>]*)>(.*)$/.exec(part);
    if (!match) {
      continue;
    }
    const rels: string[] = [];
    // `rel` may be quoted and hold several space separated relations.
    const relPattern = /;\s*rel\s*=\s*(?:"([^"]*)"|([^\s;,]+))/gi;
    for (const rel of match[2].matchAll(relPattern)) {
      rels.push(...(rel[1] ?? rel[2]).toLowerCase().split(/\s+/));
    }
    links.push({ target: match[1], rels: rels.filter(Boolean) });
  }
  return links;
}

/**
 * Relations that tell an agent where the machine readable description of
 * the site lives. Checked against the IANA link relations registry:
 * `api-catalog` (RFC 9727), `service-desc`, `service-doc`, `service-meta` and
 * `status` (RFC 8631) and `describedby` (W3C POWDER). `preconnect` and
 * friends do not count. `ard` is the relation of Agentic Resource Discovery
 * (agenticresourcediscovery.org). UNVERIFIED: `ai-catalog` is not in the
 * IANA registry; it is kept because isitagentready.com accepts it.
 */
const AGENT_RELS: readonly string[] = [
  'api-catalog',
  'service-desc',
  'service-doc',
  'service-meta',
  'status',
  'describedby',
  'ard',
  'ai-catalog',
];

/**
 * Link headers: the home page sends a `Link` header with at least one
 * agent-useful relation.
 */
export async function checkLinkHeaders(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-link-headers';
  const probe = await env.probe('/');
  const header = probe?.headers['link'];
  if (!header) {
    return result(
      id,
      'discoverability',
      false,
      'The home page sends no Link header.',
      evidenceFor(
        env,
        '/',
        probe,
        'Link: </.well-known/api-catalog>; rel="api-catalog"',
        'http',
      ),
    );
  }
  const useful = parseLinkHeader(header).flatMap((link) =>
    link.rels.filter((rel) => AGENT_RELS.includes(rel)),
  );
  return useful.length > 0
    ? result(
        id,
        'discoverability',
        true,
        `The Link header advertises ${[...new Set(useful)].join(', ')}.`,
      )
    : result(
        id,
        'discoverability',
        false,
        'The Link header has no agent-useful relation such as api-catalog or service-desc.',
        evidenceFor(env, '/', probe, `Link: ${header}`, 'http'),
      );
}
