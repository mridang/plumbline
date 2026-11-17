import { evidenceFor, result } from './utility.js';
import type { AgentEnv, CheckResult } from './types.js';

/** Matches one `Link` header entry: the target in angle brackets and its parameters. */
const LINK_ENTRY = /^<([^>]*)>(.*)$/u;

/** Matches a run of whitespace. */
const WHITESPACE_RUN = /\s+/u;

/** One link of a `Link` header (RFC 8288). */
export interface WebLink {
  target: string;
  /** The relation types, lower-cased. */
  rels: string[];
}

/** Splits on commas that are outside `<...>` and quoted strings. */
function splitLinks(header: string): string[] {
  const scanned = Iterator.from(header).reduce(
    (state, char) => {
      const inQuote =
        char === '"' && !state.inUri ? !state.inQuote : state.inQuote;
      const opens = char === '<' && !state.inQuote;
      const closes = char === '>' && !state.inQuote;
      const inUri = opens || (state.inUri && !closes);
      return char === ',' && !inUri && !inQuote
        ? {
            parts: [...state.parts, state.current],
            current: '',
            inUri,
            inQuote,
          }
        : {
            parts: state.parts,
            current: state.current + char,
            inUri,
            inQuote,
          };
    },
    { parts: [] as string[], current: '', inUri: false, inQuote: false },
  );
  return [...scanned.parts, scanned.current].flatMap((part) => {
    const trimmed = part.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  });
}

/** Parses a `Link` header value into its links. */
export function parseLinkHeader(header: string): WebLink[] {
  // `rel` may be quoted and hold several space separated relations.
  const relationshipPattern = /;\s*rel\s*=\s*(?:"([^"]*)"|([^\s;,]+))/giu;
  return splitLinks(header).flatMap((part) => {
    const match = LINK_ENTRY.exec(part);
    if (!match) {
      return [];
    }
    const rels = [...match[2].matchAll(relationshipPattern)].flatMap(
      (parameter) =>
        (parameter.at(1) ?? parameter.at(2) ?? '')
          .toLowerCase()
          .split(WHITESPACE_RUN),
    );
    return [{ target: match[1], rels: rels.filter(Boolean) }];
  });
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
const AGENT_RELS: ReadonlySet<string> = new Set([
  'api-catalog',
  'service-desc',
  'service-doc',
  'service-meta',
  'status',
  'describedby',
  'ard',
  'ai-catalog',
]);

/**
 * Link headers: the home page sends a `Link` header with at least one
 * agent-useful relation.
 */
export async function checkLinkHeaders(env: AgentEnv): Promise<CheckResult> {
  const id = 'agent-link-headers';
  const probe = await env.probe('/');
  const header = probe?.headers.link;
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
    link.rels.filter((relationship) => AGENT_RELS.has(relationship)),
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
