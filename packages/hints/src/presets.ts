import { GROUPS } from './core/groups.js';
import { PLACEMENT, SECTION_DEFS } from './core/taxonomy-data.js';
import type { Group } from './core/groups.js';
import type { Tier } from './core/taxonomy-data.js';

/** Orders hint ids in the default locale order. */
const collator = new Intl.Collator();

/** The name webhint knows this package by, used as the prefix of hint ids. */
export const PACKAGE_NAME = '@mridang/webhint-hint-plumbline';

/**
 * A webhint configuration that switches on every hint of one group. Webhint
 * validates an extended file as a whole configuration, so a preset names a
 * connector and the parser its hints read; a project's own `.hintrc`
 * overrides either.
 */
export interface Preset {
  connector: { name: string };
  parsers: string[];
  hints: Record<string, 'default'>;
}

/**
 * Builds one preset per group. Hints are set to `default` so each keeps the
 * severity its rule defines (an error, a warning or a hint) instead of being
 * forced to a single level.
 */
export function buildPresets(
  byGroup: Record<Group, readonly string[]>,
): Record<Group, Preset> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the entries are built from GROUPS, so every Group key is present
  return Object.fromEntries(
    GROUPS.map((group) => [
      group,
      {
        connector: { name: 'puppeteer' },
        parsers: ['html'],
        hints: Object.fromEntries(
          [...byGroup[group]]
            .toSorted(collator.compare)
            .map((id) => [`${PACKAGE_NAME}/${id}`, 'default']),
        ),
      },
    ]),
  ) as Record<Group, Preset>;
}

/** The tiers a set of each level holds, as the web app's rule sets do. */
const TIERS_OF: Readonly<Record<Tier, readonly Tier[]>> = {
  recommended: ['recommended'],
  advanced: ['recommended', 'advanced'],
  experimental: ['experimental'],
};

/** A preset that switches on the given hints, each at its own severity. */
function presetOf(ids: readonly string[]): Preset {
  return {
    connector: { name: 'puppeteer' },
    parsers: ['html'],
    hints: Object.fromEntries(
      [...ids]
        .toSorted(collator.compare)
        .map((id) => [`${PACKAGE_NAME}/${id}`, 'default']),
    ),
  };
}

/** Presets by the file name they are served under. */
export interface PresetsByName {
  [name: string]: Preset;
}

/**
 * Builds the presets of the taxonomy, by file name: `plumbline-recommended`,
 * `plumbline-advanced`, `plumbline-experimental` and `plumbline-all` (the
 * rule sets of the same names: the first two cover the sections that are on
 * by default), and `section-<id>-<tier>` for each section and tier. A check
 * the registry does not know is left out.
 */
export function buildTaxonomyPresets(ids: readonly string[]): PresetsByName {
  const known = new Set(ids);
  const placed = Object.entries(PLACEMENT).filter(([id]) => known.has(id));
  const on = new Set(
    SECTION_DEFS.filter((s) => s.defaultOn !== false).map((s) => s.id),
  );
  const pick = (tier: Tier, sections?: ReadonlySet<string>): string[] =>
    placed
      .filter(
        ([, p]) =>
          TIERS_OF[tier].includes(p.tier) &&
          (!sections || sections.has(p.section)),
      )
      .map(([id]) => id);
  return {
    'plumbline-recommended': presetOf(pick('recommended', on)),
    'plumbline-advanced': presetOf(pick('advanced', on)),
    'plumbline-experimental': presetOf(pick('experimental')),
    'plumbline-all': presetOf(placed.map(([id]) => id)),
    ...Object.fromEntries(
      SECTION_DEFS.flatMap((section) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Object.keys is typed string[]; TIERS_OF is declared as Record<Tier, ...>, so its keys are exactly the Tier union
        (Object.keys(TIERS_OF) as Tier[]).map((tier) => [
          `section-${section.id}-${tier}`,
          presetOf(pick(tier, new Set([section.id]))),
        ]),
      ),
    ),
  };
}
