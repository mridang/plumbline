/**
 * Readers for JSON-LD structured data, ported from LLMScout's GEO checks.
 * They work on plain parsed JSON, so they can be unit tested without a scan.
 */

/** The part of a DOM element these readers use. */
interface ElementLike {
  textContent: string;
}

/** The part of a DOM document these readers use. */
export interface JsonLdDocument {
  querySelectorAll(selector: string): ElementLike[];
}

/** The JSON-LD blocks of a page: the parsed ones and how many failed. */
export interface JsonLdBlocks {
  /** Number of `<script type="application/ld+json">` elements. */
  total: number;
  /** Number whose text is not valid JSON (an empty block counts). */
  invalid: number;
  /** The parsed value of every valid block. */
  parsed: unknown[];
  /** Position among the blocks of each entry of `parsed`. */
  parsedAt: number[];
  /** Position among the blocks of each invalid one. */
  invalidAt: number[];
}

/** Entity types that count for the Organization/Person check. */
const ENTITY_TYPES = ['Organization', 'Corporation', 'LocalBusiness', 'Person'];

/** Entity types, in the order LLMScout lists them in its message. */
export const ENTITY_TYPE_LABEL = ENTITY_TYPES.join('/');

/** Reads and parses every JSON-LD block of the document. */
export function readJsonLd(doc: JsonLdDocument): JsonLdBlocks {
  const elements = doc.querySelectorAll('script[type="application/ld+json" i]');
  const parsed: unknown[] = [];
  const parsedAt: number[] = [];
  const invalidAt: number[] = [];
  elements.forEach((element, index) => {
    try {
      parsed.push(JSON.parse(element.textContent));
      parsedAt.push(index);
    } catch {
      invalidAt.push(index);
    }
  });
  return {
    total: elements.length,
    invalid: invalidAt.length,
    parsed,
    parsedAt,
    invalidAt,
  };
}

/** True when a node's `@type` is, or (as an array) contains, `type`. */
function nodeHasType(node: Record<string, unknown>, type: string): boolean {
  const value = node['@type'];
  return value === type || (Array.isArray(value) && value.includes(type));
}

/** Narrows an unknown value to a plain object. */
function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * True when the value (an object, an array of objects, or an object with a
 * `@graph`) holds a node whose `@type` is `type`.
 */
export function containsType(value: unknown, type: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsType(item, type));
  }
  const node = asObject(value);
  if (node === null) {
    return false;
  }
  if (nodeHasType(node, type)) {
    return true;
  }
  return '@graph' in node ? containsType(node['@graph'], type) : false;
}

/**
 * True when the value holds a `SpeakableSpecification` node, or any node with
 * a truthy `speakable` property (it is normally nested on a WebPage/Article).
 */
export function containsSpeakable(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsSpeakable(item));
  }
  const node = asObject(value);
  if (node === null) {
    return false;
  }
  if (nodeHasType(node, 'SpeakableSpecification') || node['speakable']) {
    return true;
  }
  return '@graph' in node ? containsSpeakable(node['@graph']) : false;
}

/** True when `@type` (a string or an array of strings) is an entity type. */
function hasEntityType(typeValue: unknown): boolean {
  if (typeof typeValue === 'string') {
    return ENTITY_TYPES.includes(typeValue);
  }
  return (
    Array.isArray(typeValue) &&
    typeValue.some((t) => typeof t === 'string' && ENTITY_TYPES.includes(t))
  );
}

/** Finds the first Organization/Person node, looking inside arrays and `@graph`. */
export function findEntityNode(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findEntityNode(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  const node = asObject(value);
  if (node === null) {
    return null;
  }
  if (hasEntityType(node['@type'])) {
    return node;
  }
  return '@graph' in node ? findEntityNode(node['@graph']) : null;
}

/** True when `sameAs` is a non-empty array or a non-blank string. */
export function hasNonEmptySameAs(node: Record<string, unknown>): boolean {
  const sameAs = node['sameAs'];
  if (Array.isArray(sameAs)) {
    return sameAs.length > 0;
  }
  return typeof sameAs === 'string' && sameAs.trim().length > 0;
}
