import type { IHintConstructor } from 'hint';
import { GROUPS, type Group } from './core/groups.js';
import type { HintDefinition } from './core/define-hint.js';

/** Collects hint definitions from every set into one lookup. */
export function buildRegistry(definitions: readonly HintDefinition[]): {
  /** The shape webhint expects from a package with several hints. */
  hints: Record<string, IHintConstructor>;
  /** Hint ids that belong to each group. */
  byGroup: Record<Group, string[]>;
} {
  const hints: Record<string, IHintConstructor> = {};
  const byGroup = Object.fromEntries(
    GROUPS.map((g) => [g, [] as string[]]),
  ) as Record<Group, string[]>;

  for (const definition of definitions) {
    if (hints[definition.id]) {
      throw new Error(`Duplicate hint id: ${definition.id}`);
    }
    hints[definition.id] = definition.ctor;
    for (const group of definition.groups) {
      byGroup[group].push(definition.id);
    }
  }

  return { hints, byGroup };
}
