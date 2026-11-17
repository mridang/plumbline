import { isObject } from '../../src/lib/wellknown/json.js';

/** A hint as the registry holds it: only its metadata matters here. */
interface HintLike {
  meta: { docs?: object };
}

/**
 * The documentation of a hint as plain data. Webhint types `docs` with three
 * fields, but `defineHint` stamps more onto it (groups, placement, origins),
 * so a test reads them as values to check rather than as typed fields.
 */
export function docsOf(hint: HintLike): Readonly<Record<string, unknown>> {
  return isObject(hint.meta.docs) ? hint.meta.docs : {};
}

/** The groups a hint declares; none when it declares none. */
export function groupsOf(hint: HintLike): string[] {
  const { groups } = docsOf(hint);
  return Array.isArray(groups)
    ? groups.filter((group): group is string => typeof group === 'string')
    : [];
}

/** A documentation field that is text, or an empty string. */
export function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
