/**
 * @packageDocumentation
 *
 * What a pull request's preview is judged against. A preview should fail its
 * check only for problems the change brought, not for the ones the live site
 * already has, so its findings are compared with the latest run of the live
 * site that the preview is a copy of (the baseline).
 *
 * Which live site that is, is never guessed. In order:
 *
 * 1. the `previews` mapping of `plumbline.yaml`, the first environment-name
 *    pattern that matches the preview's environment;
 * 2. the repository's only site, when it has just one;
 * 3. the one site whose environment name is the preview's with the words that
 *    only say "preview" (`preview`, `pr`, `staging`, `review`, `dev`, `pull`,
 *    `request`) and any numbers taken away: `preview_prd_foo` and `pr-12-prd_foo`
 *    are both `prd_foo`; when two sites would match, or none, there is no
 *    baseline;
 * 4. otherwise there is no baseline and the preview is judged on its own.
 *
 * A finding is the same as one in the baseline when it is of the same check
 * (the rule): the wording of a message can carry the address it was found on,
 * and a baseline warning that became an error is still the same problem.
 */

import { globMatches } from '@/domain/suite/glob';

import type { StoredFinding } from '@/domain/suite/diff';

/** The words of an environment name that only say it is a copy, not which service it is. */
const COPY_WORDS = new Set([
  'preview',
  'previews',
  'pr',
  'staging',
  'review',
  'dev',
  'pull',
  'request',
]);

/**
 * What an environment name stands for once the words that mark a copy and the
 * numbers are taken away: `Preview-prd_foo` and `prd_foo` are both `prd_foo`.
 * Empty for a name that is only such words (`Preview`).
 */
export function environmentKey(name: string): string {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (word) => word !== '' && !COPY_WORDS.has(word) && !/^\d+$/.test(word),
    )
    .join('_');
}

/** A site of the repository, as far as finding a preview's baseline goes. */
export interface BaselineSite {
  readonly host: string;
  /** The deployment environment that reported the site; null for the others. */
  readonly environment: string | null;
}

/** The host of the live site a preview is a copy of, or null when that cannot be told. */
export function baselineHost(input: {
  /** The preview's deployment environment. */
  readonly environment: string;
  readonly sites: readonly BaselineSite[];
  /** The `previews` mapping of the file: environment-name patterns and hosts. */
  readonly mapping: readonly (readonly [string, string])[];
}): string | null {
  const mapped = input.mapping.find(([pattern]) =>
    globMatches(pattern, input.environment),
  );
  if (mapped) {
    return mapped[1];
  }
  const [only, ...rest] = input.sites;
  if (only && rest.length === 0) {
    return only.host;
  }
  const key = environmentKey(input.environment);
  if (key === '') {
    return null;
  }
  const same = input.sites.filter(
    (site) =>
      site.environment !== null && environmentKey(site.environment) === key,
  );
  const [match, ...others] = same;
  return match && others.length === 0 ? match.host : null;
}

/** What the live site's latest run found, and the checks it ran. */
export interface Baseline {
  /** The host of the live site. */
  readonly host: string;
  readonly findings: readonly StoredFinding[];
  /** The checks the live site's rules ask for; a preview finding on any other check cannot be compared. */
  readonly levels: ReadonlySet<string>;
}

/** How a preview's findings stand against the baseline. */
export interface Comparison {
  /** The host of the live site compared with. */
  readonly host: string;
  /** Found on the preview and not on the live site: what the change brought. */
  readonly added: readonly StoredFinding[];
  /** Found on both: not the change's doing. */
  readonly existing: readonly StoredFinding[];
  /** Found on the live site and not on the preview: what the change fixed. */
  readonly fixed: readonly StoredFinding[];
  /** Found by a check the live site's rules do not run, so there is nothing to compare with. */
  readonly uncompared: readonly StoredFinding[];
}

/**
 * Sorts a preview's findings against the baseline. `previewChecks` are the
 * checks the preview's rules ask for: a check the preview did not run cannot
 * have been fixed by it.
 */
export function compareWithBaseline(
  findings: readonly StoredFinding[],
  baseline: Readonly<Baseline>,
  previewChecks: ReadonlySet<string>,
): Comparison {
  const was = new Set(baseline.findings.map((found) => found.id));
  const is = new Set(findings.map((found) => found.id));
  const comparable = findings.filter((found) => baseline.levels.has(found.id));
  const fixed = new Map<string, StoredFinding>();
  for (const found of baseline.findings) {
    if (
      found.severity !== 'hint' &&
      previewChecks.has(found.id) &&
      !is.has(found.id) &&
      !fixed.has(found.id)
    ) {
      fixed.set(found.id, found);
    }
  }
  return {
    host: baseline.host,
    added: comparable.filter((found) => !was.has(found.id)),
    existing: comparable.filter((found) => was.has(found.id)),
    fixed: [...fixed.values()],
    uncompared: findings.filter((found) => !baseline.levels.has(found.id)),
  };
}

/**
 * How the check ends: an error the change brought fails it. A warning it
 * brought, or a finding there is nothing to compare with, leaves it neutral,
 * and so does nothing new at all if the live site had the same problems.
 * Problems the live site already has never fail it.
 */
export function comparisonConclusion(
  comparison: Readonly<Comparison>,
): 'success' | 'failure' | 'neutral' {
  if (comparison.added.some((found) => found.severity === 'error')) {
    return 'failure';
  }
  const worries = [...comparison.added, ...comparison.uncompared].some(
    (found) => found.severity !== 'hint',
  );
  return worries ? 'neutral' : 'success';
}
