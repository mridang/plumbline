/**
 * The sections hints are sorted into, shown as the sidebar of the report, and
 * the helpers that read the taxonomy data (`taxonomy-data.ts`). A hint has one
 * home (a section and a subsection) plus tags for the other goals it serves,
 * a tier, a target, who controls its fix and the month it was added. See
 * README.md for the policy; the data is the single source of truth.
 */
import { GROUP_DEFS, SECTION_DEFS, type GroupDef } from './taxonomy-data.js';

export {
  AUDIENCE_TAGS,
  CONTROLS,
  GROUP_DEFS,
  HOW_TO_FIX,
  INTRO,
  OPT_IN_NOTE,
  PLACEMENT,
  PROFILES,
  SECTION_DEFS,
  SECTION_TAG_TWINS,
  SET_DEFS,
  TAG_IDS,
  TARGETS,
  TIERS,
} from './taxonomy-data.js';
export type {
  Control,
  GroupDef,
  HowToFix,
  Placement,
  ProfileDef,
  SectionDef,
  SetDef,
  SetKind,
  Target,
  Tier,
} from './taxonomy-data.js';

/** A section with its position in the report and its display group's title. */
export interface Section {
  id: string;
  title: string;
  /** One line explaining what the section holds. */
  description: string;
  /** Who usually has to make the fix, which settles borderline cases. */
  fixer: string;
  /** One plain sentence on what the section is about. */
  intro: string;
  /** Whether the section is part of the default rule sets. */
  defaultOn: boolean;
  /** The display group the section is shown under. */
  group: string;
  groupTitle: string;
  /** Where the section comes in a report, from zero. */
  order: number;
}

/**
 * The sections in report order: display groups in their order, and the
 * sections of a group in the order the group lists them.
 */
export const SECTIONS: readonly Section[] = GROUP_DEFS.flatMap(
  (group: GroupDef) => group.sections.map((id) => ({ group, id })),
).map(({ group, id }, order) => {
  const def = SECTION_DEFS.find((section) => section.id === id);
  if (!def) {
    throw new Error(`Group ${group.id} lists unknown section ${id}`);
  }
  return {
    id,
    title: def.title,
    description: def.scope,
    fixer: def.fixer,
    intro: def.intro,
    defaultOn: def.defaultOn !== false,
    group: group.id,
    groupTitle: group.title,
    order,
  };
});
