/**
 * @packageDocumentation
 *
 * The rule sets, worked out from the catalogue: nothing here lists a check by
 * id. A section has three sets, `plumbline:<section>/recommended` (its checks
 * of the recommended tier), `/advanced` (those and its advanced ones) and
 * `/experimental` (its experimental ones); a section can have none of a kind,
 * and the set is then empty but still exists, so its name stays stable.
 *
 * `plumbline:recommended` is the union of the recommended sets of the sections
 * that are on by default, and `plumbline:advanced` the union of their advanced
 * sets; a section that is opt-in joins by name (`plumbline:email/recommended`).
 * `plumbline:experimental` holds every experimental check, `plumbline:all`
 * every check, and a profile is the union of some sets, listed in the hints
 * package (the tests hold its checks to that union).
 */

import {
  CHECKS,
  PROFILES,
  SECTIONS,
  SET_INFOS,
  type Check,
  type SetInfo,
  type SetKind,
  type Tier,
} from '@/domain/checks/catalogue';

/** The kinds of rule set. */
export type RuleSetKind = SetKind;

/** One rule set and the checks it holds. */
export interface RuleSetDef {
  /** The name a configuration file extends, such as `plumbline:recommended`. */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** One sentence for a newcomer, and when to use the set. */
  readonly summary: string;
  readonly whenToUse: string;
  readonly kind: RuleSetKind;
  /** The section of a per-section set. */
  readonly section?: string;
  /** The sets a profile is the union of. */
  readonly extends?: readonly string[];
  /** The check ids, sorted. */
  readonly members: readonly string[];
}

/** The tiers a set of each level holds. */
const TIERS_OF: Readonly<Record<Tier, readonly Tier[]>> = {
  recommended: ['recommended'],
  advanced: ['recommended', 'advanced'],
  experimental: ['experimental'],
};

/** The ids of the checks of some tiers, in some sections (every section when none). */
function idsOf(
  tiers: readonly Tier[],
  sections?: ReadonlySet<string>,
): string[] {
  return CHECKS.filter(
    (check: Check) =>
      tiers.includes(check.tier) &&
      (sections === undefined || sections.has(check.section)),
  )
    .map((check) => check.id)
    .toSorted((a, b) => Number(a > b) - Number(a < b));
}

/** The sections the default sets cover. */
const DEFAULT_SECTIONS: ReadonlySet<string> = new Set(
  SECTIONS.filter((section) => section.default_on).map((section) => section.id),
);

/** The checks a top-level or per-section set holds, from its name. */
function membersOf(set: SetInfo): string[] {
  if (set.id === 'plumbline:recommended') {
    return idsOf(TIERS_OF.recommended, DEFAULT_SECTIONS);
  }
  if (set.id === 'plumbline:advanced') {
    return idsOf(TIERS_OF.advanced, DEFAULT_SECTIONS);
  }
  if (set.id === 'plumbline:experimental') {
    return idsOf(TIERS_OF.experimental);
  }
  if (set.id === 'plumbline:all') {
    return CHECKS.map((check) => check.id).toSorted(
      (a, b) => Number(a > b) - Number(a < b),
    );
  }
  const tier = set.id.slice(set.id.lastIndexOf('/') + 1) as Tier;
  return idsOf(TIERS_OF[tier], new Set(set.section ? [set.section] : []));
}

/** Every rule set: the top-level and per-section ones from the catalogue, then the profiles. */
export const RULE_SET_DEFS: readonly RuleSetDef[] = [
  ...SET_INFOS.map((set): RuleSetDef => ({ ...set, members: membersOf(set) })),
  ...PROFILES.map((profile): RuleSetDef => ({
    ...profile,
    members: [...profile.members].toSorted(
      (a, b) => Number(a > b) - Number(a < b),
    ),
  })),
];

/** The rule set with this name, or undefined. */
export function findRuleSet(id: string): RuleSetDef | undefined {
  return RULE_SET_DEFS.find((set) => set.id === id);
}
