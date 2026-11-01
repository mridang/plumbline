/**
 * @packageDocumentation
 *
 * The hints this site can run, read from the hints package itself, so a hint
 * added there shows up here with no change. Each hint class carries its name,
 * description, reference, groups, origins and report section on `meta.docs`
 * (see the hints package's `defineHint`); who usually makes the fix comes from
 * the section.
 */

import type { HintContext } from 'hint';
import extraHints from '@mridang/webhint-hint-plumbline';
import { CATEGORIES } from '@mridang/webhint-hint-plumbline/dist/core/taxonomy.js';

/** A hint class as the hints package exports it. */
export interface HintClass {
  new (context: HintContext): unknown;
  readonly meta?: { readonly docs?: Readonly<Record<string, unknown>> };
}

/** An upstream check a hint was taken from. */
export interface HintOrigin {
  readonly source: string;
  readonly title: string;
  readonly url: string;
  readonly docsUrl?: string;
  readonly summary: string;
}

/** What the page shows about one hint. */
export interface HintInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** The rule's source, when the hint links one. */
  readonly reference?: string;
  /** The report section the hint is sorted into, and its order on the page. */
  readonly section: string;
  readonly sectionTitle: string;
  readonly sectionOrder: number;
  /** The sources and topics the hint belongs to. */
  readonly groups: readonly string[];
  /** Who usually makes the fix, from the hint's section. */
  readonly fixer?: string;
  /** The upstream checks it was taken from; empty for one written here. */
  readonly origins: readonly HintOrigin[];
}

/** One runnable hint: what it is, and the class to start. */
export interface CatalogueEntry {
  readonly info: HintInfo;
  readonly ctor: HintClass;
}

/** A string field of `docs`, or the fallback. */
function text(
  docs: Readonly<Record<string, unknown>>,
  key: string,
  fallback: string,
): string {
  const value = docs[key];
  return typeof value === 'string' ? value : fallback;
}

/** Who usually makes the fix for a hint in each section. */
const FIXERS: ReadonlyMap<string, string> = new Map(
  CATEGORIES.map((category) => [category.id, category.whoFixesIt]),
);

/** A string, or undefined. */
function stringOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** The origins listed on `docs`, keeping only well-formed ones. */
function originsOf(value: unknown): HintOrigin[] {
  return (Array.isArray(value) ? (value as unknown[]) : []).flatMap((raw) => {
    if (typeof raw !== 'object' || raw === null) {
      return [];
    }
    const origin = raw as Readonly<Record<string, unknown>>;
    const source = stringOf(origin['source']);
    const url = stringOf(origin['url']);
    if (source === undefined || url === undefined) {
      return [];
    }
    const docsUrl = stringOf(origin['docsUrl']);
    return [
      {
        source,
        title:
          stringOf(origin['title']) || (stringOf(origin['upstreamId']) ?? url),
        url,
        ...(docsUrl ? { docsUrl } : {}),
        summary: stringOf(origin['summary']) ?? '',
      },
    ];
  });
}

/** The entry for one hint class. */
export function entryOf(id: string, ctor: HintClass): CatalogueEntry {
  const docs = ctor.meta?.docs ?? {};
  const order = docs['sectionOrder'];
  const reference = docs['url'];
  const section = text(docs, 'section', 'other');
  const fixer = FIXERS.get(section);
  const groups = docs['groups'];
  return {
    ctor,
    info: {
      id,
      name: text(docs, 'name', id),
      description: text(docs, 'description', ''),
      ...(typeof reference === 'string' ? { reference } : {}),
      section,
      sectionTitle: text(docs, 'sectionTitle', 'Other'),
      sectionOrder: typeof order === 'number' ? order : Number.MAX_SAFE_INTEGER,
      groups: Array.isArray(groups)
        ? groups.filter((group): group is string => typeof group === 'string')
        : [],
      ...(fixer ? { fixer } : {}),
      origins: originsOf(docs['origins']),
    },
  };
}

/** Every hint the hints package ships, sorted by id. */
export function catalogue(
  hints: Readonly<Record<string, HintClass>> = extraHints as unknown as Record<
    string,
    HintClass
  >,
): CatalogueEntry[] {
  return Object.keys(hints)
    .sort()
    .flatMap((id) => {
      const ctor = hints[id];
      return ctor ? [entryOf(id, ctor)] : [];
    });
}
