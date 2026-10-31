import { UsageError } from './options.js';
import type { HintMeta } from './scan.js';

/** Which hints a scan should run, as given on the command line. */
export interface Selection {
  only: readonly string[];
  skip: readonly string[];
  groups: readonly string[];
}

/**
 * Findings and webhint's own config name hints `extra/<id>`, so a user may
 * paste that form back into `--only`; it means the same bare id.
 */
function bare(id: string): string {
  return id.replace(/^extra\//, '');
}

/** Every group at least one hint in the catalogue belongs to. */
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
  known: Set<string>,
): void {
  const unknown = names.filter((name) => !known.has(name));
  if (unknown.length > 0) {
    throw new UsageError(
      `unknown ${kind}${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')} ` +
        `(run "plumbline checks" to list them)`,
    );
  }
}

/**
 * Narrows the catalogue to the hints in any of the given groups; every hint
 * when no group is given.
 *
 * @param catalogue Every shipped hint.
 * @param groups Group names, for example `owasp` or `tls`.
 * @returns The matching catalogue entries, in catalogue order.
 * @throws UsageError when a group matches no hint.
 */
export function filterByGroups(
  catalogue: readonly HintMeta[],
  groups: readonly string[],
): HintMeta[] {
  requireKnown('group', groups, knownGroups(catalogue));
  if (groups.length === 0) {
    return [...catalogue];
  }
  return catalogue.filter((hint) =>
    hint.groups.some((g) => groups.includes(g)),
  );
}

/**
 * Works out the hint ids to run: the `--only` ids (or every hint), kept to
 * those in a `--group` when one is given, less the `--skip` ids.
 *
 * @param catalogue Every shipped hint.
 * @param selection The `--only`, `--skip` and `--group` lists.
 * @returns The bare ids to run, in catalogue order.
 * @throws UsageError for an unknown id or group, or when nothing is left.
 */
export function selectHints(
  catalogue: readonly HintMeta[],
  selection: Selection,
): string[] {
  const ids = new Set(catalogue.map((hint) => hint.id));
  const only = selection.only.map(bare);
  const skip = new Set(selection.skip.map(bare));
  requireKnown('check', only, ids);
  requireKnown('check', [...skip], ids);
  const chosen = filterByGroups(catalogue, selection.groups)
    .map((hint) => hint.id)
    .filter((id) => only.length === 0 || only.includes(id))
    .filter((id) => !skip.has(id));
  if (chosen.length === 0) {
    throw new UsageError(
      'the --only, --skip and --group options leave no checks to run',
    );
  }
  return chosen;
}
