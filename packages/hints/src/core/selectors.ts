/**
 * Resolves the names people use to pick checks (`--group`, a rule set, a REST
 * filter) into the checks they stand for. A selector is a section, a tag, a
 * target, a control, a tier or a source, written with its kind in front
 * (`section:https`, `tag:seo`) or bare when the name is unambiguous. Old
 * group names keep working through {@link ALIASES}.
 */
import { ALIASES, SOURCE_GROUPS } from './groups.js';
import {
  CONTROLS,
  PLACEMENT,
  SECTION_DEFS,
  TAG_IDS,
  TARGETS,
  TIERS,
} from './taxonomy.js';

/** What a selector looks at. */
export type SelectorKind =
  'section' | 'tag' | 'target' | 'control' | 'tier' | 'source' | 'group';

/** One resolved selector. */
export interface Selector {
  kind: SelectorKind;
  value: string;
}

/** The prefixes a selector can be written with, and the names each accepts. */
const KINDS: Readonly<
  Record<Exclude<SelectorKind, 'group'>, readonly string[]>
> = {
  section: SECTION_DEFS.map((section) => section.id),
  tag: TAG_IDS,
  target: TARGETS,
  control: CONTROLS.map((control) => control.id),
  tier: TIERS,
  source: SOURCE_GROUPS,
};

/** What a check is, for matching: its id and the groups it lists. */
export interface Subject {
  id: string;
  groups: readonly string[];
}

/** Whether a selector picks a check. */
export function matches(selector: Selector, subject: Subject): boolean {
  const placement = PLACEMENT[subject.id];
  switch (selector.kind) {
    case 'section':
      return placement?.section === selector.value;
    case 'tag':
      return placement?.tags.includes(selector.value) ?? false;
    case 'target':
      return placement?.target === selector.value;
    case 'control':
      return placement?.control === selector.value;
    case 'tier':
      return placement?.tier === selector.value;
    case 'source':
    case 'group':
      return subject.groups.includes(selector.value);
  }
}

/**
 * Reads a selector written with its kind (`tag:seo`).
 *
 * @returns The selector, or undefined when the kind or the name is unknown.
 */
function prefixed(name: string): Selector | undefined {
  const colon = name.indexOf(':');
  if (colon < 0) {
    return undefined;
  }
  const kind = name.slice(0, colon);
  const value = name.slice(colon + 1);
  for (const [known, values] of Object.entries(KINDS)) {
    if (known === kind && values.includes(value)) {
      return { kind: known as SelectorKind, value };
    }
  }
  return undefined;
}

/**
 * Turns a name into the selectors it stands for, or undefined when it names
 * nothing. A bare name is read as a tag first (a section that is also a tag is
 * a twin, and the tag is the larger set), then as a section, target, tier,
 * control or source, then as an old alias, and last as an old group.
 *
 * @param name A selector, with or without its kind, or an old group name.
 * @param groups Every group name hints list, for the old groups.
 */
export function resolve(
  name: string,
  groups: ReadonlySet<string>,
): readonly Selector[] | undefined {
  const given = prefixed(name);
  if (given) {
    return [given];
  }
  for (const kind of [
    'tag',
    'section',
    'target',
    'tier',
    'control',
    'source',
  ] as const) {
    if (KINDS[kind].includes(name)) {
      return [{ kind, value: name }];
    }
  }
  const alias = ALIASES[name];
  if (alias) {
    return alias.flatMap((selector) => prefixed(selector) ?? []);
  }
  return groups.has(name) ? [{ kind: 'group', value: name }] : undefined;
}
