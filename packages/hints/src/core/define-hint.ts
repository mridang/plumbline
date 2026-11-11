import type { HintContext, HintMetadata, IHintConstructor } from 'hint';
import { HintScope } from '#hint';
import { Category } from '@hint/utils-types';
import type { Group } from './groups.js';
import { ORIGINS, type Origin } from './origins.js';
import {
  PLACEMENT,
  SECTIONS,
  type Control,
  type Target,
  type Tier,
} from './taxonomy.js';

/** Describes one hint and how it attaches itself to a scan. */
export interface HintSpec {
  /** Short id, unique in the package, for example `csp`. */
  id: string;
  /** Human readable name shown in reports. */
  name: string;
  /** One sentence describing what the hint checks. */
  description: string;
  category: Category;
  /** Every group this hint belongs to, including its source. */
  groups: readonly Group[];
  /** Where the rule is documented, shown to users in the README. */
  reference?: string;
  /** Defaults to `site`, which runs once per scan. */
  scope?: HintScope;

  /**
   * JSON schema for the hint's options, as webhint expects it. Leave it out
   * for a hint without options.
   */
  schema?: HintMetadata['schema'];
  /** Called once per scan with the context; subscribe to events here. */
  setup(context: HintContext): void;
}

/** A hint ready to be listed in the package and in presets. */
export interface HintDefinition {
  id: string;
  groups: readonly Group[];
  reference?: string;
  ctor: IHintConstructor;
}

/**
 * Wraps the context so every finding carries the hint's reference as a
 * "Further reading" link, next to any link the finding already has. Webhint's
 * report shows this list under each finding and has no other place for a
 * hint's own link. The context is frozen, so it is wrapped, not changed.
 */
function withReference(context: HintContext, spec: HintSpec): HintContext {
  if (!spec.reference) {
    return context;
  }
  const link = { link: spec.reference, text: spec.name };
  const report: HintContext['report'] = (resource, message, options) => {
    const given = options.documentation ?? [];
    const documentation = given.some((d) => d.link === link.link)
      ? given
      : [...given, link];
    context.report(resource, message, { ...options, documentation });
  };
  return new Proxy(context, {
    get(target, property) {
      if (property === 'report') {
        return report;
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/** Turns a spec into the class webhint instantiates for each scan. */
export function defineHint(spec: HintSpec): HintDefinition {
  // Webhint types `docs` with three fields. The rest are extras that stock
  // formatters ignore and our report formatter shows: the groups, the
  // reference, where the hint is placed in the taxonomy and where it came from.
  const placement = PLACEMENT[spec.id];
  const section = SECTIONS.find((s) => s.id === placement?.section);
  const docs: HintMetadata['docs'] & {
    url?: string;
    groups: readonly Group[];
    section?: string;
    sectionTitle?: string;
    sectionDescription?: string;
    sectionOrder?: number;
    group?: string;
    groupTitle?: string;
    subsection?: string;
    tags: readonly string[];
    tier?: Tier;
    target?: Target;
    control?: Control;
    since?: number;
    added?: string;
    origins: readonly Origin[];
  } = {
    category: spec.category,
    description: spec.description,
    name: spec.name,
    groups: spec.groups,
    ...(spec.reference ? { url: spec.reference } : {}),
    ...(section
      ? {
          section: section.id,
          sectionTitle: section.title,
          sectionDescription: section.description,
          sectionOrder: section.order,
          group: section.group,
          groupTitle: section.groupTitle,
        }
      : {}),
    ...(placement
      ? {
          subsection: placement.subsection,
          tier: placement.tier,
          target: placement.target,
          control: placement.control,
          since: placement.since,
          added: placement.added,
        }
      : {}),
    tags: placement?.tags ?? [],
    origins: ORIGINS[spec.id] ?? [],
  };
  const meta: HintMetadata = {
    docs,
    getDescription: () => spec.description,
    getName: () => spec.name,
    id: `extra/${spec.id}`,
    schema: spec.schema ?? [],
    scope: spec.scope ?? HintScope.site,
  };

  class ExtraHint {
    public static readonly meta = meta;

    public constructor(context: HintContext) {
      spec.setup(withReference(context, spec));
    }
  }

  return {
    id: spec.id,
    groups: spec.groups,
    reference: spec.reference,
    ctor: ExtraHint,
  };
}

export { Category } from '@hint/utils-types';
