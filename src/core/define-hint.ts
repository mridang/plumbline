import {
  HintScope,
  type HintContext,
  type HintMetadata,
  type IHintConstructor,
} from 'hint';
import { Category } from '@hint/utils-types';
import type { Group } from './groups.js';

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

/** Turns a spec into the class webhint instantiates for each scan. */
export function defineHint(spec: HintSpec): HintDefinition {
  const meta: HintMetadata = {
    docs: {
      category: spec.category,
      description: spec.description,
      name: spec.name,
    },
    getDescription: () => spec.description,
    getName: () => spec.name,
    id: `extra/${spec.id}`,
    schema: [],
    scope: spec.scope ?? HintScope.site,
  };

  class ExtraHint {
    public static readonly meta = meta;

    public constructor(context: HintContext) {
      spec.setup(context);
    }
  }

  return {
    id: spec.id,
    groups: spec.groups,
    reference: spec.reference,
    ctor: ExtraHint,
  };
}

export { Category };
