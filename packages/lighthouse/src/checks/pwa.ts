/**
 * The `pwa` check set: the Progressive-Web-App hints a Lighthouse *plugin* can
 * run from the artifacts Lighthouse already gathers. Only the two DOM hints
 * qualify — `manifest-linked` and `theme-color-meta` — because they read solely
 * the parsed page. The other two hints of the webhint `pwa` set
 * (`manifest-valid`, `manifest-icons`) fetch the manifest document, which a
 * plugin cannot do, so they are webhint-only and have no check here.
 *
 * Each check reshapes `MainDocumentContent` into the tiny `DocumentLike` the
 * shared `src/lib/pwa/read.ts` readers take, then calls the *same single-source
 * rule function* the webhint hint calls (`src/lib/pwa/checks.ts`) and returns
 * its findings. The predicate, message and severity therefore live in one place
 * and cannot drift between the hint and this check.
 *
 * Titles, descriptions, references and the section are pulled from the compiled
 * webhint hint metadata (`../meta.ts`), never restated here.
 *
 * Scoring. `manifest-linked` is a genuine install gate a homepage run can
 * reproduce from the DOM, so it is graded (`numeric`). `theme-color-meta` is
 * advice (the webhint hint reports it at `Severity.hint`), so it is
 * `informative` — surfaced but never scored.
 */
import { createHTMLDocument } from '@hint/utils-dom';
import type { Artifacts } from 'lighthouse';
import type { HintDefinition } from '@mridang/webhint-hint-plumbline/dist/core/define-hint.js';
import type { DocumentLike } from '@mridang/webhint-hint-plumbline/dist/lib/pwa/read.js';
// The single-source PWA rules: predicate + message + severity. Both this check
// and the webhint hints call these, so neither restates the wording.
import {
  manifestLinked,
  themeColorMeta,
} from '@mridang/webhint-hint-plumbline/dist/lib/pwa/checks.js';
import { hintDocs } from '../meta.js';
import type { AuditCheck } from './types.js';

// The compiled webhint hints, imported only for their metadata (name,
// description, reference, section); their check logic is reused through the
// `src/lib/pwa/**` rule functions above, not through these modules.
import manifestLinkedHint from '@mridang/webhint-hint-plumbline/dist/hints/pwa/manifest-linked.js';
import themeColorMetaHint from '@mridang/webhint-hint-plumbline/dist/hints/pwa/theme-color-meta.js';

/** The artifacts both PWA checks read: the raw HTML and the page URL. */
const HTML_ONLY = ['MainDocumentContent', 'URL'] as const;

/** The page URL a check resolves relative links against. */
function pageUrl(artifacts: Artifacts): string {
  return (
    artifacts.URL?.finalDisplayedUrl || artifacts.URL?.mainDocumentUrl || ''
  );
}

/**
 * Parses `MainDocumentContent` into the {@link DocumentLike} the readers query.
 * The readers only ask for `<link rel="manifest">` and
 * `<meta name="theme-color">`, both of which webhint's DOM implementation
 * answers directly, so the parsed document is used as-is — the same parser and
 * the same selectors the webhint hints see.
 */
function documentOf(artifacts: Artifacts): DocumentLike {
  const html = artifacts.MainDocumentContent ?? '';
  return createHTMLDocument(
    html,
    pageUrl(artifacts) || 'http://localhost/',
  ) as unknown as DocumentLike;
}

/**
 * Builds a check that borrows its metadata from a compiled webhint hint. The
 * title, description, reference and section are taken from the hint and never
 * restated; the `run` body reuses the shared `src/lib/pwa/checks.ts` rule
 * function, so the finding message matches the webhint hint byte for byte.
 */
function fromHint(
  definition: HintDefinition,
  config: {
    scoreMode: AuditCheck['scoreMode'];
    run: AuditCheck['run'];
  },
): AuditCheck {
  const docs = hintDocs(definition);
  return {
    id: definition.id,
    section: docs.section ?? 'pwa',
    title: docs.name,
    description: docs.description,
    reference: docs.url,
    scoreMode: config.scoreMode,
    requiredArtifacts: HTML_ONLY,
    run: config.run,
  };
}

/** The two DOM PWA checks, in the order the webhint `pwa` set lists them. */
export const pwaChecks: readonly AuditCheck[] = [
  fromHint(manifestLinkedHint, {
    scoreMode: 'numeric',
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? manifestLinked(documentOf(artifacts))
        : null,
  }),

  fromHint(themeColorMetaHint, {
    scoreMode: 'informative',
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? themeColorMeta(documentOf(artifacts))
        : null,
  }),
];
