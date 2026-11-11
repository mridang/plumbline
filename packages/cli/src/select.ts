import {
  matches,
  resolve,
  type Selector,
} from '@mridang/webhint-hint-plumbline/dist/core/selectors.js';
import {
  PLACEMENT,
  TARGETS,
  TIERS,
} from '@mridang/webhint-hint-plumbline/dist/core/taxonomy.js';
import { UsageError } from './options.js';
import type { HintMeta } from './scan.js';

/** Which hints a scan should run, as given on the command line. */
export interface Selection {
  only: readonly string[];
  skip: readonly string[];
  /** Section, tag, target, tier, control, source or old group names. */
  groups: readonly string[];
  tiers?: readonly string[];
  targets?: readonly string[];
}

/** The filters on top of `--group`: a hint must also be in one of these. */
export interface Filters {
  tiers?: readonly string[];
  targets?: readonly string[];
}

/**
 * Findings and webhint's own config name hints `extra/<id>`, so a user may
 * paste that form back into `--only`; it means the same bare id.
 */
function bare(id: string): string {
  return id.replace(/^extra\//, '');
}

/** Every group at least one hint in the catalogue lists. */
function knownGroups(catalogue: readonly HintMeta[]): Set<string> {
  return new Set(catalogue.flatMap((hint) => hint.groups));
}

/**
 * Refuses names that match nothing, listing them all, so a typo in `--only`
 * or `--group` fails loudly instead of quietly scanning less than intended.
 */
function requireKnown(
  kind: string,
  names: readonly string[],
  known: (name: string) => boolean,
): void {
  const unknown = names.filter((name) => !known(name));
  if (unknown.length > 0) {
    throw new UsageError(
      `unknown ${kind}${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')} ` +
        `(run "plumbline checks" to list them)`,
    );
  }
}

/**
 * Narrows the catalogue to the hints in any of the given groups (a group is a
 * section, tag, target, tier, control or source, bare or written with its kind
 * such as `tag:seo`, or an old group name such as `tls`) that are also in one of
 * the given tiers and targets; every hint when none is given.
 * @param catalogue - Every shipped hint.
 * @param groups - Selector names, for example `owasp`, `section:https` or `tls`.
 * @param filters - Tiers and targets a hint must also be in.
 * @returns The matching catalogue entries, in catalogue order.
 * @throws UsageError when a name matches nothing.
 */
export function filterByGroups(
  catalogue: readonly HintMeta[],
  groups: readonly string[],
  filters: Filters = {},
): HintMeta[] {
  const known = knownGroups(catalogue);
  requireKnown('group', groups, (name) => resolve(name, known) !== undefined);
  requireKnown('tier', filters.tiers ?? [], (name) =>
    (TIERS as readonly string[]).includes(name),
  );
  requireKnown('target', filters.targets ?? [], (name) =>
    (TARGETS as readonly string[]).includes(name),
  );
  const selectors: Selector[] = groups.flatMap(
    (name) => resolve(name, known) ?? [],
  );
  return catalogue.filter((hint) => {
    const subject = { id: hint.id, groups: hint.groups };
    const placement = PLACEMENT[hint.id];
    return (
      (groups.length === 0 ||
        selectors.some((selector) => matches(selector, subject))) &&
      (!filters.tiers?.length ||
        (placement !== undefined && filters.tiers.includes(placement.tier))) &&
      (!filters.targets?.length ||
        (placement !== undefined && filters.targets.includes(placement.target)))
    );
  });
}

/**
 * Works out the hint ids to run: the `--only` ids (or every hint), kept to
 * those in a `--group`, `--tier` or `--target` when given, less the `--skip`
 * ids.
 * @param catalogue - Every shipped hint.
 * @param selection - The `--only`, `--skip`, `--group`, `--tier` and `--target` lists.
 * @returns The bare ids to run, in catalogue order.
 * @throws UsageError for an unknown id or name, or when nothing is left.
 */
export function selectHints(
  catalogue: readonly HintMeta[],
  selection: Selection,
): string[] {
  const ids = new Set(catalogue.map((hint) => hint.id));
  const only = selection.only.map(bare);
  const skip = new Set(selection.skip.map(bare));
  requireKnown('check', only, (name) => ids.has(name));
  requireKnown('check', [...skip], (name) => ids.has(name));
  const chosen = filterByGroups(catalogue, selection.groups, selection)
    .map((hint) => hint.id)
    .filter((id) => only.length === 0 || only.includes(id))
    .filter((id) => !skip.has(id));
  if (chosen.length === 0) {
    throw new UsageError(
      'the --only, --skip, --group, --tier and --target options leave no checks to run',
    );
  }
  return chosen;
}
