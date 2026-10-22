/**
 * Set-specific adapter for the `opengraph` checks: turns Lighthouse's
 * `MetaElements` artifact into the tiny {@link MetaDocument} the shared Open
 * Graph reader (`src/lib/opengraph/meta.ts`) walks, and exposes a `meta(key)`
 * reader backed by that library's `metaValue`.
 *
 * The webhint Open Graph hints read their tags through `metaValue(doc, key)`
 * (see `src/lib/opengraph/define.ts`), where `doc` is the scanned page's DOM.
 * A Lighthouse plugin has no DOM, only the already-parsed `MetaElements`
 * artifact, so this shim presents those entries as the handful of `<meta>`
 * attributes the reader looks at (`property`, `name`, `content`). Feeding the
 * reader through this shim means the audits resolve exactly the same tag
 * values the hints do, so a site yields the same findings here as under the
 * webhint hints.
 *
 * The shared `adapt.ts` has an equivalent private shim for the header set, but
 * it is not exported; this module keeps the Open Graph variant local to its
 * set, importing only the read-only `MetaElementArtifact` type from it and the
 * library reader from the compiled parent build.
 */
import type { MetaElementArtifact } from './adapt.js';
import {
  metaValue,
  type MetaDocument,
} from '@mridang/webhint-hint-extra/dist/lib/opengraph/meta.js';

/**
 * Wraps the `MetaElements` artifact in the {@link MetaDocument} the Open Graph
 * reader walks. The reader only ever calls `querySelectorAll('meta')` and then
 * reads the `property`, `name` and `content` attributes, so every artifact
 * entry becomes one element mapping those attribute names onto its parsed
 * fields.
 *
 * Source artifact: `MetaElements`.
 */
function metaDocument(
  metaElements: readonly MetaElementArtifact[],
): MetaDocument {
  const elements = metaElements.map((meta) => ({
    getAttribute(attribute: string): string | null {
      switch (attribute.toLowerCase()) {
        case 'property':
          return meta.property ?? null;
        case 'name':
          return meta.name ?? null;
        case 'content':
          return meta.content ?? null;
        default:
          return null;
      }
    },
  }));
  return {
    // The reader always passes 'meta'; every artifact entry already is a meta.
    querySelectorAll: () => elements,
  };
}

/**
 * Returns a `meta(key)` reader over the `MetaElements` artifact, giving the
 * first non-empty value of an `og:*` or `twitter:*` tag (matched on either the
 * `property` or `name` attribute, as the library does), or null when absent.
 * This is the `OgContext.meta` the webhint hints' `check` functions receive.
 *
 * Source artifact: `MetaElements`.
 */
export function ogMetaReader(
  metaElements: readonly MetaElementArtifact[],
): (key: string) => string | null {
  const doc = metaDocument(metaElements);
  return (key: string) => metaValue(doc, key);
}
