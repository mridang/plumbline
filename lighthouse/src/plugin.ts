/**
 * `lighthouse-plugin-webhint-extra` — a Lighthouse plugin whose audits are
 * generated from a declarative table (`checks/`) and reuse the webhint-hints
 * check logic (the pure functions in the parent package's `src/lib/**`, consumed
 * as the compiled `../../dist/lib/**`). Each audit produces the same findings
 * its webhint hint would for the subset of checks whose data Lighthouse already
 * gathers.
 *
 * A Lighthouse plugin cannot add gatherers, so every check reads only artifacts
 * Lighthouse gathers by default (`DevtoolsLog`, `URL`, `MetaElements`,
 * `LinkElements`). The plugin manifest is assembled here from the registry and
 * the shared taxonomy, so it never drifts from them:
 *
 *   - `audits`    one `{ path }` per check (Lighthouse serialises the plugin
 *                 config as JSON, so audits must be referenced by module path;
 *                 the path points at the check's thin wrapper module).
 *   - `groups`    the taxonomy CATEGORIES that at least one check lands in; the
 *                 eight sections in `src/core/taxonomy.ts` are the single source
 *                 of grouping. Lighthouse prefixes each group id with the plugin
 *                 name, so `site-protection` becomes
 *                 `lighthouse-plugin-webhint-extra-site-protection`.
 *   - `auditRefs` one per check, grouped by its section, weighted 1 for a scored
 *                 check and 0 for an informative one.
 */
import { checks } from './checks/index.js';
import { CATEGORIES } from '../../dist/core/taxonomy.js';

/** The published package name Lighthouse resolves audit module paths against. */
const PACKAGE = 'lighthouse-plugin-webhint-extra';

/**
 * One audit per check, referenced by the compiled path of its wrapper module.
 * The wrapper's default export is the `Audit` subclass the factory built.
 */
const audits = checks.map((check) => ({
  path: `${PACKAGE}/dist/audits/${check.id}.js`,
}));

/** The sections at least one check lands in. */
const usedSections = new Set(checks.map((check) => check.section));

/**
 * The groups, taken straight from the taxonomy so their titles and order match
 * the rest of the project. Only sections with audits are included.
 */
const groups = Object.fromEntries(
  CATEGORIES.filter((category) => usedSections.has(category.id)).map(
    (category) => [
      category.id,
      { title: category.title, description: category.description },
    ],
  ),
);

/**
 * One weighted auditRef per check, assigned to its section's group. Informative
 * checks (whose webhint hint is context-specific) are shown but not scored, so
 * they weigh 0; every other check weighs 1.
 */
const auditRefs = checks.map((check) => ({
  id: `webhint-${check.id}`,
  weight: check.scoreMode === 'informative' ? 0 : 1,
  group: check.section,
}));

/** The plugin's category. */
const category = {
  title: 'Webhint extra',
  description:
    'Extra audits that reuse the webhint-hints check logic for the checks Lighthouse can run from its own artifacts.',
  auditRefs,
};

/** The plugin manifest Lighthouse loads via `--plugins`. */
export default { audits, category, groups };
