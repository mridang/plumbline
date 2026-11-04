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
  checks as GENERATED,
  sections as GENERATED_SECTIONS,
} from '../../../dist/catalogue';

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
}

/** Every section, in report order. */
export const SECTIONS: readonly Section[] = GENERATED_SECTIONS;

/** Every check, sorted by id. */
export const CHECKS: readonly Check[] = GENERATED;

/** The checks by id. */
const BY_ID: ReadonlyMap<string, Check> = new Map(
  CHECKS.map((check) => [check.id, check]),
);

/** Every group a check belongs to, sorted. */
export const GROUPS: readonly string[] = [
  ...new Set(CHECKS.flatMap((check) => check.groups)),
].toSorted();

/** The check with this id, or undefined. */
export function findCheck(id: string): Check | undefined {
  return BY_ID.get(id);
}

/** Whether `id` names a check. */
export function isCheckId(id: string): boolean {
  return BY_ID.has(id);
}

/** The checks in a group (an unknown group has none). */
export function checksInGroup(group: string): readonly Check[] {
  return CHECKS.filter((check) => check.groups.includes(group));
}

/**
 * The ids of the checks a domain runs: the ones chosen for it, or every check
 * when none were chosen (`null`). Ids of checks that no longer exist are left
 * out, so a check removed from the hints package simply stops running.
 */
export function enabledChecks(chosen: readonly string[] | null): string[] {
  return chosen === null
    ? CHECKS.map((check) => check.id)
    : chosen.filter(isCheckId);
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
 * Expand a list of check ids and group names (`tls`, `owasp`) into check ids,
 * keeping the names that are neither so the caller can refuse them. A name that
 * is both a check and a group counts as the check.
 */
export function expandSelection(names: readonly string[]): Selection {
  const ids = new Set<string>();
  const unknown: string[] = [];
  for (const name of names) {
    if (isCheckId(name)) {
      ids.add(name);
    } else if (GROUPS.includes(name)) {
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
