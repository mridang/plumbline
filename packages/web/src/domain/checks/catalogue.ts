/**
 * @packageDocumentation
 *
 * The checks plumbline knows about, as the server sees them: what each one is
 * called, what it looks at, which groups it belongs to, who usually fixes what
 * it finds and where it came from. The list is
 * generated from the hints package at build time (`scripts/build-catalogue.mjs`)
 * because the checks' own code only ever runs in the browser and is far too big
 * for the Worker. A check added to the hints package shows up here on the next
 * build with no change.
 */

import {
  aliases as GENERATED_ALIASES,
  checks as GENERATED,
  controls as GENERATED_CONTROLS,
  displayGroups as GENERATED_DISPLAY_GROUPS,
  intro as GENERATED_INTRO,
  optInNote as GENERATED_OPT_IN_NOTE,
  setDefs as GENERATED_SET_DEFS,
  profiles as GENERATED_PROFILES,
  sections as GENERATED_SECTIONS,
  tags as GENERATED_TAGS,
} from '../../../dist/catalogue';

/** How strongly a check is recommended. */
export type Tier = 'recommended' | 'advanced' | 'experimental';

/** The tiers, from the calmest to the most speculative. */
export const TIERS: readonly Tier[] = [
  'recommended',
  'advanced',
  'experimental',
];

/** What a check looks at. */
export type Target = 'web' | 'mail' | 'site';

/** The targets. */
export const TARGETS: readonly Target[] = ['web', 'mail', 'site'];

/** Who can fix what a check finds. */
export type Control = 'deployer' | 'platform' | 'dns' | 'mail';

/** The controls. */
export const CONTROLS: readonly Control[] = [
  'deployer',
  'platform',
  'dns',
  'mail',
];

/** What each control means, in a sentence. */
export const CONTROL_INFO: readonly { id: Control; description: string }[] =
  GENERATED_CONTROLS as readonly { id: Control; description: string }[];

/** How to fix a check on the two platforms the baseline was written for. */
export interface HowToFix {
  /** The fix, in a sentence. */
  readonly fix: string;
  readonly vercel?: string;
  readonly cloudflare?: string;
}

/** An upstream check, test or article a check was taken from. */
export interface CheckOrigin {
  /** The source group, such as `observatory`. */
  readonly source: string;
  readonly title: string;
  /** The code or page of the upstream check. */
  readonly url: string;
  /** A documentation page for it, when there is one. */
  readonly docs_url?: string;
  /** What the upstream check looks at, in a sentence or two. */
  readonly summary: string;
}

/** What the server knows about one check. */
export interface Check {
  /** The check's id, such as `csp-header`. */
  readonly id: string;
  readonly name: string;
  /** One sentence on what the check looks at. */
  readonly description: string;
  /** The sources and topics the check belongs to, such as `owasp` or `tls`. */
  readonly groups: readonly string[];
  /** The report section the check is sorted into, by id and by title. */
  readonly section: string;
  readonly section_title: string;
  /** Where the section comes in a report. */
  readonly section_order: number;
  /** The display group of the section, by id. */
  readonly group: string;
  /** Free-text subsection inside the section. */
  readonly subsection: string;
  /** Goal and audience tags, such as `security` or `store`. */
  readonly tags: readonly string[];
  readonly tier: Tier;
  readonly target: Target;
  readonly control: Control;
  /** The catalogue version in which the check entered its tier. */
  readonly since: number;
  /** The month the check was added, `YYYY-MM`. */
  readonly added: string;
  /** A note on the placement or the tier, when there is one. */
  readonly note?: string;
  /** How to fix it, written for the checks of the recommended tier. */
  readonly how_to_fix?: HowToFix;
  /** Where the rule comes from, when the check links it. */
  readonly reference?: string;
  /** Who usually makes the fix (the web server, the DNS zone, …), from its section. */
  readonly fixer?: string;
  /** The upstream checks it was taken from; empty for one written for plumbline. */
  readonly origins: readonly CheckOrigin[];
}

/** A report section: an area the checks are sorted into. */
export interface Section {
  readonly id: string;
  readonly title: string;
  /** One line on what the section holds. */
  readonly description: string;
  /** Who usually makes the fixes in it. */
  readonly fixer: string;
  /** Where it comes in a report. */
  readonly order: number;
  /** One plain sentence on what the section is about. */
  readonly intro: string;
  /** The display group, by id and title. */
  readonly group: string;
  readonly group_title: string;
  /** Whether `plumbline:recommended` includes the section; an opt-in section is added by name. */
  readonly default_on: boolean;
}

/** A display group: sections shown together, never a selector. */
export interface DisplayGroup {
  readonly id: string;
  readonly title: string;
  readonly sections: readonly string[];
}

/** The kinds of named sets. */
export type SetKind = 'top' | 'section' | 'profile';

/** A named set, with the words the rules pages use for it. */
export interface SetInfo {
  readonly id: string;
  readonly kind: SetKind;
  readonly title: string;
  readonly description: string;
  readonly summary: string;
  readonly whenToUse: string;
  /** The section of a per-section set. */
  readonly section?: string;
}

/** A set of checks that is listed by hand: a profile, the union of other sets. */
export interface Profile extends SetInfo {
  /** The sets it is the union of. */
  readonly extends: readonly string[];
  /** Every check of the profile, sorted. */
  readonly members: readonly string[];
}

/** The top-level and per-section sets; their checks follow from tiers and sections. */
export const SET_INFOS: readonly SetInfo[] =
  GENERATED_SET_DEFS as readonly SetInfo[];

/** An introduction to rules and rule sets, one paragraph each. */
export const INTRO: readonly string[] = GENERATED_INTRO;

/** What to know about the sections that are off by default. */
export const OPT_IN_NOTE: string = GENERATED_OPT_IN_NOTE;

/** The display groups, in order. */
export const DISPLAY_GROUPS: readonly DisplayGroup[] = GENERATED_DISPLAY_GROUPS;

/** The hand-listed sets. */
export const PROFILES: readonly Profile[] =
  GENERATED_PROFILES as readonly Profile[];

/** The closed list of tags. */
export const TAGS: readonly string[] = GENERATED_TAGS;

/** Every section, in report order. */
export const SECTIONS: readonly Section[] = GENERATED_SECTIONS;

/** Every check, sorted by id. */
export const CHECKS = GENERATED as readonly Check[];

/** The checks by id. */
const BY_ID: ReadonlyMap<string, Check> = new Map(
  CHECKS.map((check) => [check.id, check]),
);

/** The groups checks list: the sources and the old topics. */
const CHECK_GROUPS: ReadonlySet<string> = new Set(
  GENERATED.flatMap((check) => check.groups),
);

/** What a selector looks at. */
type SelectorKind =
  'section' | 'tag' | 'target' | 'control' | 'tier' | 'source' | 'group';

/** The names each kind of selector accepts. */
const KINDS: Readonly<
  Record<Exclude<SelectorKind, 'group'>, readonly string[]>
> = {
  section: SECTIONS.map((section) => section.id),
  tag: TAGS,
  target: TARGETS,
  control: CONTROLS,
  tier: TIERS,
  source: [...CHECK_GROUPS],
};

/** Old names that stand for selectors, as the hints package maps them. */
const ALIASES: Readonly<Record<string, readonly string[]>> = GENERATED_ALIASES;

/** One resolved selector. */
interface Selector {
  readonly kind: SelectorKind;
  readonly value: string;
}

/** A selector written with its kind (`tag:seo`), or undefined. */
function prefixed(name: string): Selector | undefined {
  const colon = name.indexOf(':');
  if (colon === -1) {
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
 * The selectors a name stands for: a selector with its kind, or a bare tag,
 * section, target, tier, control, source or old group name, or an alias.
 */
function selectorsOf(name: string): readonly Selector[] | undefined {
  const given = prefixed(name);
  if (given) {
    return [given];
  }
  for (const kind of ['tag', 'section', 'target', 'tier', 'control'] as const) {
    if (KINDS[kind].includes(name)) {
      return [{ kind, value: name }];
    }
  }
  const alias = ALIASES[name];
  if (alias) {
    return alias.flatMap((selector) => prefixed(selector) ?? []);
  }
  return CHECK_GROUPS.has(name) ? [{ kind: 'group', value: name }] : undefined;
}

/** Whether a selector picks a check. */
function picks(selector: Selector, check: Check): boolean {
  switch (selector.kind) {
    case 'section': {
      return check.section === selector.value;
    }
    case 'tag': {
      return check.tags.includes(selector.value);
    }
    case 'target': {
      return check.target === selector.value;
    }
    case 'control': {
      return check.control === selector.value;
    }
    case 'tier': {
      return check.tier === selector.value;
    }
    case 'source':
    case 'group': {
      return check.groups.includes(selector.value);
    }
  }
}

const GROUP_NAMES = new Set(KINDS.section)
  .union(new Set(KINDS.tag))
  .union(new Set(KINDS.target))
  .union(new Set(KINDS.tier))
  .union(CHECK_GROUPS)
  .union(new Set(Object.keys(ALIASES)));
/**
 * Every name that selects checks: the sections, tags, targets, tiers, controls,
 * sources and old topic groups, and the aliases of old names. A name may also be
 * written with its kind, such as `tag:seo`.
 */
export const GROUPS: readonly string[] = [...GROUP_NAMES].toSorted(
  (a, b) => Number(a > b) - Number(a < b),
);

/** The check with this id, or undefined. */
export function findCheck(id: string): Check | undefined {
  return BY_ID.get(id);
}

/** Whether `id` names a check. */
export function isCheckId(id: string): boolean {
  return BY_ID.has(id);
}

/** Whether `name` selects checks (a selector, with or without its kind, or an old group). */
export function isGroup(name: string): boolean {
  return selectorsOf(name) !== undefined;
}

/** The checks a name selects (an unknown name selects none). */
export function checksInGroup(group: string): readonly Check[] {
  const selectors = selectorsOf(group) ?? [];
  return CHECKS.filter((check) =>
    selectors.some((selector) => picks(selector, check)),
  );
}

/**
 * The ids of the checks a domain runs: the ones chosen for it, or every check
 * when none were chosen (`null`). Ids of checks that no longer exist are left
 * out, so a check removed from the hints package simply stops running.
 */
export function enabledChecks(chosen: readonly string[] | null): string[] {
  return chosen === null
    ? CHECKS.map((check) => check.id)
    : chosen.filter((id) => isCheckId(id));
}

/**
 * The checks to store for a domain once some are switched on and some off,
 * starting from the ones it runs now. Null means "every check" (so a check
 * added later runs too), which is what is stored whenever the result is every
 * check there is.
 */
export function applyChoice(
  current: readonly string[] | null,
  choice: Readonly<{ enable?: readonly string[]; disable?: readonly string[] }>,
): string[] | null {
  const on = new Set(enabledChecks(current));
  (choice.enable ?? []).forEach((id) => on.add(id));
  (choice.disable ?? []).forEach((id) => on.delete(id));
  const ids = CHECKS.map((check) => check.id).filter((id) => on.has(id));
  return ids.length === CHECKS.length ? null : ids;
}

/** What a list of check ids and group names stands for. */
export interface Selection {
  /** The check ids, with every group expanded into its checks. */
  readonly ids: readonly string[];
  /** The names that are neither a check nor a group. */
  readonly unknown: readonly string[];
}

/**
 * Expand a list of check ids and group names (`tls`, `owasp`, `section:email`) into check ids,
 * keeping the names that are neither so the caller can refuse them. A name that
 * is both a check and a group counts as the check.
 */
export function expandSelection(names: readonly string[]): Selection {
  const ids = new Set<string>();
  const unknown: string[] = [];
  for (const name of names) {
    if (isCheckId(name)) {
      ids.add(name);
    } else if (isGroup(name)) {
      checksInGroup(name).forEach((check) => ids.add(check.id));
    } else {
      unknown.push(name);
    }
  }
  return { ids: [...ids], unknown };
}

/** How many checks each section holds, by section id. */
export function checksPerSection(): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const check of CHECKS) {
    counts.set(check.section, (counts.get(check.section) ?? 0) + 1);
  }
  return counts;
}
