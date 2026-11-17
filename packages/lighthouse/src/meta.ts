/**
 * Reads a webhint hint's metadata out of the parent package's compiled output,
 * so the Lighthouse audit that reuses a hint's check logic also reuses its
 * name, description, reference link and section instead of restating them. This
 * keeps the webhint hint the single source of those strings: change the hint
 * and the Lighthouse audit follows on the next build.
 *
 * The compiled hint is the default export of `dist/hints/<set>/<id>.js` (a
 * {@link HintDefinition}). `defineHint` stores the strings on
 * `ctor.meta.docs`, augmenting webhint's own `docs` type with our extra fields
 * (`url`, `section`, ...). Those extras are not described by the published
 * `HintMetadata` type, so they are read through the narrow structural type
 * {@link WebhintDocumentation} below.
 */
import type { HintDefinition } from '@mridang/webhint-hint-plumbline/dist/core/define-hint.js';

/** The subset of a hint's compiled `docs` this plugin borrows. */
export interface WebhintDocumentation {
  /** The hint's human-readable name. */
  name: string;
  /** The hint's one-sentence description. */
  description: string;
  /** The hint's reference link, when it has one. */
  url?: string;
  /** The taxonomy category id the hint is placed in. */
  section?: string;
  /** The taxonomy category's title. */
  sectionTitle?: string;
  /** The taxonomy category's description. */
  sectionDescription?: string;
}

/**
 * Returns the borrowed metadata of a compiled hint. The cast is required
 * because `defineHint`'s extra `docs` fields are intentionally not part of the
 * published `HintMetadata` type; the shape is produced by this repo, so reading
 * it structurally is safe.
 */
export function hintDocumentation(
  definition: HintDefinition,
): WebhintDocumentation {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- defineHint stamps these fields onto docs, but the published HintMetadata type leaves them out
  return definition.ctor.meta.docs as unknown as WebhintDocumentation;
}
