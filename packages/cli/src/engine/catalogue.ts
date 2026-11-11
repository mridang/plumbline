import type { HintContext } from 'hint';
import extraHints from '@mridang/webhint-hint-plumbline';
import { SECTIONS } from '@mridang/webhint-hint-plumbline/dist/core/taxonomy.js';

/**
 * The hints as the scan engine sees them: each one's description for the
 * report (its section, the sources it comes from, who fixes what it finds) and
 * the class to run. Read off the `meta.docs` the hints package stamps on every
 * hint, defaulting anything missing.
 */

/** A hint class as the hints package exports it. */
export interface HintClass {
  new (context: HintContext): unknown;
  readonly meta?: { readonly docs?: Readonly<Record<string, unknown>> };
}

/** Where a check comes from: the upstream project's rule it follows. */
export interface HintOrigin {
  readonly source: string;
  readonly title: string;
  readonly url: string;
  readonly docsUrl?: string;
  readonly summary: string;
}

/** What a report says about a hint, run or not. */
export interface HintInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly reference?: string;
  /** The report section the hint belongs to. */
  readonly section: string;
  readonly sectionTitle: string;
  readonly sectionOrder: number;
  readonly groups: readonly string[];
  /** The display group of the section, and the hint's place in it. */
  readonly group?: string;
  readonly subsection?: string;
  /** Goal and audience tags, for example `seo` or `store`. */
  readonly tags: readonly string[];
  /** `recommended`, `advanced` or `experimental`. */
  readonly tier?: string;
  /** What the hint looks at: `web`, `mail` or `site`. */
  readonly target?: string;
  /** Who can fix what it finds: `deployer`, `platform`, `dns` or `mail`. */
  readonly control?: string;
  /** The month the hint was added, `YYYY-MM`. */
  readonly added?: string;
  /** Who usually fixes what the hint finds. */
  readonly fixer?: string;
  readonly origins: readonly HintOrigin[];
}

/** A hint to run, with its description. */
export interface CatalogueEntry {
  readonly info: HintInfo;
  readonly ctor: HintClass;
}

/** A string field of `docs`, or `fallback`. */
function text(
  docs: Readonly<Record<string, unknown>>,
  key: string,
  fallback: string,
): string {
  const value = docs[key];
  return typeof value === 'string' ? value : fallback;
}

/** Who fixes a section's findings, by section id. */
const FIXERS: ReadonlyMap<string, string> = new Map(
  SECTIONS.map((section) => [section.id, section.fixer]),
);

/** A string, or undefined for anything else. */
function stringOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** The origins of a hint, leaving out any entry without a source and a link. */
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

/** The catalogue entry of one hint class. */
export function entryOf(id: string, ctor: HintClass): CatalogueEntry {
  const docs = ctor.meta?.docs ?? {};
  const order = docs['sectionOrder'];
  const reference = docs['url'];
  const section = text(docs, 'section', 'other');
  const fixer = FIXERS.get(section);
  const groups = docs['groups'];
  const tags = docs['tags'];
  const group = stringOf(docs['group']);
  const subsection = stringOf(docs['subsection']);
  const tier = stringOf(docs['tier']);
  const target = stringOf(docs['target']);
  const control = stringOf(docs['control']);
  const added = stringOf(docs['added']);
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
      ...(group ? { group } : {}),
      ...(subsection ? { subsection } : {}),
      tags: Array.isArray(tags)
        ? tags.filter((tag): tag is string => typeof tag === 'string')
        : [],
      ...(tier ? { tier } : {}),
      ...(target ? { target } : {}),
      ...(control ? { control } : {}),
      ...(added ? { added } : {}),
      ...(fixer ? { fixer } : {}),
      origins: originsOf(docs['origins']),
    },
  };
}

/** Every hint of the package, by id, as catalogue entries. */
export function catalogue(
  hints: Readonly<Record<string, HintClass>> = extraHints as unknown as Record<
    string,
    HintClass
  >,
): CatalogueEntry[] {
  return Object.keys(hints)
    .toSorted((a, b) => a.localeCompare(b))
    .flatMap((id) => {
      const ctor = hints[id];
      return ctor ? [entryOf(id, ctor)] : [];
    });
}
