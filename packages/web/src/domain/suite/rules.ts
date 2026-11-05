/**
 * @packageDocumentation
 *
 * The two rule sets that ship with the app, and what a rule's level does to
 * what it reports. A rule is a check of the catalogue; a level says whether it runs and how loudly it reports, as in
 * ESLint:
 *
 * - `off` turns the rule off,
 * - `warn` and `error` report everything the rule finds as that severity,
 * - `on` reports each finding with the severity the check gave it.
 *
 * The rule sets are `plumbline:recommended`, what a site with no configuration
 * file gets, and `plumbline:advanced`, which adds the advisory content and
 * performance rules. A rule that is not in any rule set is off until the
 * configuration file turns it on.
 */

import type { CheckResult, Finding } from '@/domain/suite/checks';

/** How a rule reports. */
export type Level = 'off' | 'on' | 'warn' | 'error';

/**
 * The rules of the advanced set: the recommended ones and the advisory content
 * and performance rules. Any check of the catalogue can be turned on by a
 * configuration file; the scanner runs all of them.
 */
const ADVANCED_RULES = [
  'icons-apple-touch-icon-missing',
  'seo-content-length',
  'seo-deprecated-html',
  'seo-http-status',
  'seo-keywords-frequent',
  'seo-keywords-in-title',
  'seo-link-anchor-text',
  'seo-links',
  'seo-responsive-images',
  'seo-url-friendly',
  'seo-viewport',
  'technical-asset-count',
  'technical-html-size',
  'technical-image-formats',
  'technical-lazy-loading',
  'technical-response-time',
] as const;

/** The rules a site gets with no configuration: the ones whose findings are worth acting on. */
const RECOMMENDED_RULES: readonly string[] = [
  'icons-apple-touch-icon-missing',
  'seo-deprecated-html',
  'seo-http-status',
  'seo-links',
  'seo-responsive-images',
  'seo-viewport',
  'technical-html-size',
  'technical-response-time',
];

/** A rule set: the levels it sets, by rule id. */
export type RuleSet = Readonly<Record<string, Level>>;

/** Every rule in `ids` at the level `on`. */
function setOf(ids: readonly string[]): RuleSet {
  return Object.fromEntries(ids.map((id) => [id, 'on' as const]));
}

/** The rule sets that ship with the app, by the name a configuration file extends. */
export const RULE_SETS: Readonly<Record<string, RuleSet>> = {
  'plumbline:recommended': setOf(RECOMMENDED_RULES),
  'plumbline:advanced': setOf(ADVANCED_RULES),
};

/** The rule set a site with no configuration uses. */
export const DEFAULT_RULE_SET = 'plumbline:recommended';

/** What a level makes of a finding's own severity, or null when the level drops it. */
function severityUnder(
  level: Level,
  own: Finding['severity'],
): Finding['severity'] | null {
  switch (level) {
    case 'off':
      return null;
    case 'warn':
      return 'warning';
    case 'error':
      return 'error';
    case 'on':
      return own;
  }
}

/**
 * The checks' findings as the rules say they are reported: a rule that is off
 * (or is not in the levels at all) reports nothing, `warn` and `error` set the
 * severity of everything the rule found, and `on` keeps each finding's own.
 */
export function applyLevels(
  checks: readonly CheckResult[],
  levels: ReadonlyMap<string, Level>,
): CheckResult[] {
  return checks.map((check) => {
    const level = levels.get(check.id) ?? 'off';
    return {
      id: check.id,
      findings: check.findings.flatMap((found): Finding[] => {
        const severity = severityUnder(level, found.severity);
        return severity === null ? [] : [{ ...found, severity }];
      }),
    };
  });
}

/**
 * A short fingerprint of the levels, so two runs can tell whether they applied
 * the same rules. The same levels give the same text whatever order they were
 * set in.
 */
export async function fingerprintOf(
  levels: ReadonlyMap<string, Level>,
): Promise<string> {
  const text = JSON.stringify(
    [...levels].toSorted(([a], [b]) => (a < b ? -1 : 1)),
  );
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest).subarray(0, 8)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
