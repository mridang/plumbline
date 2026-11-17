/**
 * Collects the relation links a page advertises, from both the DOM
 * (`<link rel>` and `<a rel>`) and the `Link` response header (RFC 8288). The
 * discovery checks (rel=me, Webmention, Pingback) all work from this one list,
 * so the DOM/header reading lives here and is unit-testable without a scan.
 */
import { parseLinkHeader } from '../agent/link-headers.js';

/** Matches a run of whitespace between the tokens of a `rel` attribute. */
const WHITESPACE_RUN = /\s+/u;

/** The slice of a DOM element these readers use. */
interface ElementLike {
  getAttribute(name: string): string | null;
}

/** The slice of a DOM document these readers use. */
export interface DocumentLike {
  querySelectorAll(selector: string): Iterable<ElementLike>;
}

/** One discovered relation link: its relation tokens and its target. */
export interface RelationshipLink {
  /** The relation types, lower-cased (a `rel` may list several). */
  rels: string[];
  /** The link target, trimmed; empty string when the attribute was blank. */
  href: string;
  /** Where the link was found, for pointing a report at the right place. */
  source: 'dom' | 'header';
}

/** Splits a `rel` attribute into its lower-cased, non-empty tokens. */
function relationshipTokens(relationship: string | null): string[] {
  return (relationship ?? '')
    .trim()
    .toLowerCase()
    .split(WHITESPACE_RUN)
    .filter((token) => token !== '');
}

/**
 * Reads every `<link rel>` and `<a rel>` of the document. The query is broad
 * (any element with a `rel`) and the relation matching is done here, so the
 * logic is exercised by unit tests rather than hidden in a CSS selector.
 */
export function domRelationshipLinks(
  parsedDocument: DocumentLike,
): RelationshipLink[] {
  return Array.from(
    parsedDocument.querySelectorAll('link[rel], a[rel]'),
    (element): RelationshipLink[] => {
      const rels = relationshipTokens(element.getAttribute('rel'));
      return rels.length === 0
        ? []
        : [
            {
              rels,
              href: (element.getAttribute('href') ?? '').trim(),
              source: 'dom',
            },
          ];
    },
  ).flat();
}

/** Reads the relation links from a `Link` response header value, or []. */
export function headerRelationshipLinks(
  linkHeader: string | null,
): RelationshipLink[] {
  if (linkHeader === null) {
    return [];
  }
  return parseLinkHeader(linkHeader).map((link) => ({
    rels: link.rels,
    href: link.target.trim(),
    source: 'header' as const,
  }));
}

/** Returns the links that carry the given relation token. */
export function withRelationship(
  links: readonly RelationshipLink[],
  relationship: string,
): RelationshipLink[] {
  const wanted = relationship.toLowerCase();
  return links.filter((link) => link.rels.includes(wanted));
}

/** True when a value is an absolute URL (has a scheme and host, or is mailto). */
export function isAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol !== '';
  } catch {
    return false;
  }
}
