import { GROUPS } from './core/groups.js';
import type { Group } from './core/groups.js';
import type { IHintConstructor } from 'hint';
import type { HintDefinition } from './core/define-hint.js';

/** The lookups built from the hint definitions. */
export interface Registry {
  /** The shape webhint expects from a package with several hints. */
  hints: Record<string, IHintConstructor>;
  /** Hint ids that belong to each group. */
  byGroup: Record<Group, string[]>;
}

/** Collects hint definitions from every set into one lookup. */
export function buildRegistry(
  definitions: readonly HintDefinition[],
): Registry {
  const ids = definitions.map((definition) => definition.id);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate !== undefined) {
    throw new Error(`Duplicate hint id: ${duplicate}`);
  }
  return {
    hints: Object.fromEntries(
      definitions.map((definition) => [definition.id, definition.ctor]),
    ),
    byGroup: Object.fromEntries(
      GROUPS.map((group) => [
        group,
        definitions.flatMap((definition) =>
          definition.groups.includes(group) ? [definition.id] : [],
        ),
      ]),
    ) as Record<Group, string[]>,
  };
}
