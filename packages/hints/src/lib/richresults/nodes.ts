/**
 * JSON-LD node helpers shared by the `richresults` checks. They operate on the
 * already-parsed JSON-LD values that `src/lib/geo/json-ld.ts`'s `readJsonLd`
 * produced, so the HTML is parsed once (by the geo reader) and never reparsed
 * here. Everything is a pure function over plain JSON, so it is unit tested
 * without a scan.
 *
 * Google's rich-results validators look at individual schema.org entity nodes
 * (a Recipe, a Product, an Event, ...) wherever they appear: at the top level,
 * inside an array, inside an `@graph`, or nested as the value of another node's
 * property (a Product nested in an ItemList, an Offer nested in a Product).
 * `findNodesOfType` therefore walks the whole parsed structure and collects
 * every object whose `@type` matches, which is what each check iterates over.
 */

/** Narrows an unknown value to a plain (non-array) object. */
export function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** True when a node's `@type` is, or (as an array) contains, `type`. */
function nodeHasType(node: Record<string, unknown>, type: string): boolean {
  const value = node['@type'];
  return value === type || (Array.isArray(value) && value.includes(type));
}

/** True when a node's `@type` matches any of `types`. */
export function nodeHasAnyType(
  node: Record<string, unknown>,
  types: readonly string[],
): boolean {
  return types.some((type) => nodeHasType(node, type));
}

/**
 * Collects every object in `value` whose `@type` matches one of `types`,
 * recursing through arrays, `@graph` and every nested property value. A node
 * that matches is still descended into, so a matching node nested inside
 * another matching node is found too.
 */
export function findNodesOfType(
  value: unknown,
  types: readonly string[],
): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const visit = (current: unknown): void => {
    if (Array.isArray(current)) {
      current.forEach((item) => visit(item));
      return;
    }
    const node = asObject(current);
    if (node === null) {
      return;
    }
    if (nodeHasAnyType(node, types)) {
      found.push(node);
    }
    // Descend into every property value (including `@graph`) so nested
    // entities are reached.
    for (const key of Object.keys(node)) {
      visit(node[key]);
    }
  };
  visit(value);
  return found;
}

/**
 * True when `node[key]` carries a usable value: a non-blank string, a finite
 * number, a non-empty array, or an object. An empty string, empty array,
 * `null` or `undefined` counts as missing, matching how Google treats an empty
 * property.
 */
export function hasValue(node: Record<string, unknown>, key: string): boolean {
  const value = node[key];
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return typeof value === 'object';
}

/**
 * Returns `node[key]` as a plain object when it is one, or when it is an array,
 * the first object element. Google often lets a property hold either a single
 * node or an array of them (an Offer, an array of Offers), so a check that
 * inspects a nested node uses this to reach it.
 */
export function firstObject(
  node: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = node[key];
  if (Array.isArray(value)) {
    for (const item of value) {
      const object = asObject(item);
      if (object) {
        return object;
      }
    }
    return null;
  }
  return asObject(value);
}

/** A short human label for a node's `@type`, for messages. */
export function typeLabel(
  node: Record<string, unknown>,
  fallback: string,
): string {
  const value = node['@type'];
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string');
    if (typeof first === 'string') {
      return first;
    }
  }
  return fallback;
}
