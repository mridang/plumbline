/**
 * @packageDocumentation
 *
 * What the rules pages need to know to show one view of the catalogue: the
 * rules of a set, an area or a tag, the filter in the address (`?q=` for text,
 * `?tier=`), which rule row is open (`?rule=`) and whether the areas of a long
 * list are folded (`?open=all|none`), and the address of the same view with
 * one thing changed. Every view is a link, so the pages are rendered on the
 * server and need no script.
 */

import { foldText } from '@/lib/intl';
import {
  CHECKS,
  SECTIONS,
  TIERS,
  type Check,
  type Section,
  type Tier,
} from '@/domain/checks/catalogue';
import { findRuleSet } from '@/domain/checks/sets';

/** A query string as Next hands it over. */
export type SearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

/** The view of a list of rules, as the address says. */
export interface View {
  /** Text the id, name, description or tags must contain. */
  readonly q: string;
  readonly tier?: Tier;
  /** The rule whose row is open. */
  readonly rule?: string;
  /** Whether every area of a long list is open or folded; undefined leaves it to the list. */
  readonly open?: 'all' | 'none';
}

/** The first value of a parameter. */
function first(value: string | readonly string[] | undefined): string {
  return (
    (Array.isArray(value) ? value[0] : (value as string | undefined)) ?? ''
  ).trim();
}

/** Reads a view from the address; what is not known is dropped. */
export function parseView(params: SearchParams): View {
  const tier = first(params['tier']);
  const rule = first(params['rule']);
  const open = first(params['open']);
  return {
    q: first(params['q']).slice(0, 80),
    ...(TIERS.includes(tier as Tier) ? { tier: tier as Tier } : {}),
    ...(CHECKS.some((check) => check.id === rule) ? { rule } : {}),
    ...(open === 'all' || open === 'none' ? { open } : {}),
  };
}

/** The query string of a view with some things changed (`undefined` removes one), with its `?`, or empty. */
export function queryOf(
  view: View,
  change: Partial<Record<keyof View, string | undefined>> = {},
): string {
  const merged: Record<string, string | undefined> = {
    q: view.q || undefined,
    tier: view.tier,
    rule: view.rule,
    open: view.open,
    ...change,
  };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) {
      query.set(key, value);
    }
  }
  const text = query.toString();
  return text === '' ? '' : `?${text}`;
}

/** The address of the overview. */
export const OVERVIEW_PATH = '/checks';

/** The address of a rule set's page: `plumbline:seo/advanced` is `/checks/sets/seo/advanced`. */
export function setPath(id: string): string {
  return `${OVERVIEW_PATH}/sets/${id.replace(/^plumbline:/, '')}`;
}

/** The rule set a page address stands for, or undefined. */
export function setOfSegments(segments: readonly string[]): string | undefined {
  const id = `plumbline:${segments.map((segment) => decodeURIComponent(segment)).join('/')}`;
  return findRuleSet(id)?.id;
}

/** The address of an area's page. */
export function areaPath(section: string): string {
  return `${OVERVIEW_PATH}/areas/${section}`;
}

/** The address of a tag's page. */
export function tagPath(tag: string): string {
  return `${OVERVIEW_PATH}/tags/${tag}`;
}

/** Whether a rule passes the text and tier of a view. */
function passes(check: Check, view: View): boolean {
  if (view.tier && check.tier !== view.tier) {
    return false;
  }
  if (view.q === '') {
    return true;
  }
  const hay = foldText(
    `${check.id} ${check.name} ${check.description} ${check.tags.join(' ')}`,
  );
  return foldText(view.q)
    .split(/\s+/)
    .every((word) => hay.includes(word));
}

/** The rules that pass a view, in the order given. */
export function filterRules(
  rules: readonly Check[],
  view: View,
): readonly Check[] {
  return rules.filter((check) => passes(check, view));
}

/** The rules of a rule set, in catalogue order. */
export function rulesOfSet(id: string): readonly Check[] {
  const members = new Set(findRuleSet(id)?.members);
  return CHECKS.filter((check) => members.has(check.id));
}

/** The rules of an area. */
export function rulesOfArea(section: string): readonly Check[] {
  return CHECKS.filter((check) => check.section === section);
}

/** The rules that carry a tag. */
export function rulesOfTag(tag: string): readonly Check[] {
  return CHECKS.filter((check) => check.tags.includes(tag));
}

/** Rules grouped by area, in report order; areas with no rule are left out. */
export function byArea(
  rules: readonly Check[],
): readonly { section: Section; rules: readonly Check[] }[] {
  return SECTIONS.map((section) => ({
    section,
    rules: rules.filter((check) => check.section === section.id),
  })).filter((entry) => entry.rules.length > 0);
}

/** Rules grouped by subsection, sorted by name. */
export function bySubsection(
  rules: readonly Check[],
): readonly { subsection: string; rules: readonly Check[] }[] {
  const names = [
    ...new Set(rules.map((check) => check.subsection || 'other')),
  ].toSorted((a, b) => Number(a > b) - Number(a < b));
  return names.map((subsection) => ({
    subsection,
    rules: rules.filter(
      (check) => (check.subsection || 'other') === subsection,
    ),
  }));
}

/** How many rules of each tier. */
export function tierCounts(
  rules: readonly Check[],
): Readonly<Record<Tier, number>> {
  return {
    recommended: rules.filter((c) => c.tier === 'recommended').length,
    advanced: rules.filter((c) => c.tier === 'advanced').length,
    experimental: rules.filter((c) => c.tier === 'experimental').length,
  };
}

/** A tag a rule carries other than the one its area already is. */
export function topicTags(check: Check): readonly string[] {
  return check.tags.filter((tag) => tag !== check.section);
}

/** The selectors that reach a rule: its area, its tags, its target and its control. */
export function selectorsFor(check: Check): string[] {
  return [
    `section:${check.section}`,
    ...check.tags.map((tag) => `tag:${tag}`),
    `target:${check.target}`,
    `control:${check.control}`,
  ];
}

/** The month a rule was added, as "June 2026". */
export function formatMonth(month: string): string {
  const [year, number] = month.split('-').map(Number);
  if (!year || !number) {
    return month;
  }
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, number - 1, 1)));
}

/** The lines of `plumbline.yaml` that turn a rule set on. */
export function yamlFor(id: string): string {
  return id === 'plumbline:recommended' || id === 'plumbline:all'
    ? `extends: ${id}`
    : `extends:\n  - plumbline:recommended\n  - ${id}`;
}
