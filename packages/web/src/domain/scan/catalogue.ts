/**
 * @packageDocumentation
 *
 * The hints this site can run, read from the hints package itself, so a hint
 * added there shows up here with no change. Each hint class carries its name,
 * description, reference and report section on `meta.docs` (see the hints
 * package's `defineHint`).
 */

import type { HintContext } from 'hint';
import extraHints from '@mridang/webhint-hint-extra';

/** A hint class as the hints package exports it. */
export interface HintClass {
  new (context: HintContext): unknown;
  readonly meta?: { readonly docs?: Readonly<Record<string, unknown>> };
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

/** The entry for one hint class. */
export function entryOf(id: string, ctor: HintClass): CatalogueEntry {
  const docs = ctor.meta?.docs ?? {};
  const order = docs['sectionOrder'];
  const reference = docs['url'];
  return {
    ctor,
    info: {
      id,
      name: text(docs, 'name', id),
      description: text(docs, 'description', ''),
      ...(typeof reference === 'string' ? { reference } : {}),
      section: text(docs, 'section', 'other'),
      sectionTitle: text(docs, 'sectionTitle', 'Other'),
      sectionOrder: typeof order === 'number' ? order : Number.MAX_SAFE_INTEGER,
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
