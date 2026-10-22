/**
 * The `i18n` check set: every webhint internationalisation hint that a
 * Lighthouse *plugin* can run from the artifacts Lighthouse already gathers.
 * Each check parses the raw `MainDocumentContent` HTML into the small
 * `DocumentLike` the shared `src/lib/i18n/read.ts` readers take, then calls the
 * *same single-source rule function* the webhint hint calls
 * (`src/lib/i18n/checks.ts`) and returns its findings. The predicate, the exact
 * message and the severity therefore live in one place and cannot drift between
 * the hint and this check.
 *
 * Where the facts come from. Every rule reads `<link>` elements (hreflang
 * alternates, `rel="alternate"` media links, `rel="prev"`/`rel="next"`), and
 * Lighthouse's own `LinkElements` artifact omits the `hreflang`/`media`
 * attributes these rules need, so the main document's HTML is parsed with
 * `@hint/utils-dom`'s `createHTMLDocument` — the same DOM implementation the
 * webhint connector builds `page.document` with, and the same one the
 * `src/lib/i18n/**` unit tests parse fixtures with. The rendered (else
 * requested) page URL is threaded in for the self-reference comparison.
 *
 * Titles, descriptions, references and the section are pulled from the compiled
 * webhint hint metadata (`../meta.ts`), never restated here.
 *
 * Scoring. These rules are warnings webhint treats as problems reproducible
 * from the DOM, so they are graded (`numeric`); the one advisory rule
 * (`hreflang-x-default`, a webhint `Severity.hint`) is `informative` — surfaced
 * but never scored.
 */
import { createRequire } from 'node:module';
import type * as LH from 'lighthouse';
import type { HTMLDocument } from '@hint/utils-dom';
import type { HintDefinition } from '../../../dist/core/define-hint.js';
import type { DocumentLike } from '../../../dist/lib/i18n/read.js';
// The single-source i18n rules: predicate + message + severity. Both this check
// and the webhint hints call these, so neither restates the wording.
import {
  alternateMedia,
  hreflangDuplicate,
  hreflangReturn,
  hreflangSelf,
  hreflangValidCodes,
  hreflangXDefault,
  paginationRel,
} from '../../../dist/lib/i18n/checks.js';
import { hintDocs } from '../meta.js';
import type { AuditCheck } from './types.js';

// The compiled webhint hints, imported only for their metadata (name,
// description, reference, section); their check logic is reused through the
// `src/lib/i18n/**` rule functions above, not through these modules.
import hreflangReturnHint from '../../../dist/hints/i18n/hreflang-return.js';
import hreflangXDefaultHint from '../../../dist/hints/i18n/hreflang-x-default.js';
import hreflangValidCodesHint from '../../../dist/hints/i18n/hreflang-valid-codes.js';
import hreflangSelfHint from '../../../dist/hints/i18n/hreflang-self.js';
import hreflangDuplicateHint from '../../../dist/hints/i18n/hreflang-duplicate.js';
import alternateMediaHint from '../../../dist/hints/i18n/alternate-media.js';
import paginationRelHint from '../../../dist/hints/i18n/pagination-rel.js';

// `@hint/utils-dom` ships as CommonJS, so it is loaded through `createRequire`
// (the pattern the SEO adapter and the tests use) rather than a named ESM
// import. The signature is narrowed to the one function this check needs.
const require = createRequire(import.meta.url);
const { createHTMLDocument } = require('@hint/utils-dom') as {
  createHTMLDocument: (html: string, finalHref: string) => HTMLDocument;
};

/** The only artifacts the i18n checks read. */
const HTML_AND_URL = ['MainDocumentContent', 'URL'] as const;

/** The page URL a check compares against (the rendered URL, else the requested). */
function pageUrl(artifacts: LH.Artifacts): string {
  return (
    artifacts.URL?.finalDisplayedUrl || artifacts.URL?.mainDocumentUrl || ''
  );
}

/**
 * Parses the main document into the {@link DocumentLike} the i18n readers
 * query. `finalHref` only resolves relative URLs; an empty document URL is
 * replaced with a harmless placeholder so parsing never throws on `new URL('')`.
 */
function documentOf(artifacts: LH.Artifacts): DocumentLike {
  const html = artifacts.MainDocumentContent ?? '';
  return createHTMLDocument(
    html,
    pageUrl(artifacts) || 'http://localhost/',
  ) as unknown as DocumentLike;
}

/**
 * Builds a check that borrows its metadata from a compiled webhint hint. The
 * title, description, reference and section are taken from the hint and never
 * restated; the `run` body reuses the shared `src/lib/i18n/checks.ts` rule
 * function, so the finding message matches the webhint hint's byte for byte.
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
    // Every i18n hint is placed in the `search` section; fall back to it
    // defensively rather than emit none.
    section: docs.section ?? 'search',
    title: docs.name,
    description: docs.description,
    reference: docs.url,
    scoreMode: config.scoreMode,
    requiredArtifacts: HTML_AND_URL,
    run: config.run,
  };
}

/** The 7 i18n checks, in the order the webhint `i18n` set lists them. */
export const i18nChecks: readonly AuditCheck[] = [
  fromHint(hreflangReturnHint, {
    scoreMode: 'numeric',
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? hreflangReturn(documentOf(artifacts))
        : null,
  }),

  fromHint(hreflangXDefaultHint, {
    scoreMode: 'informative',
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? hreflangXDefault(documentOf(artifacts))
        : null,
  }),

  fromHint(hreflangValidCodesHint, {
    scoreMode: 'numeric',
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? hreflangValidCodes(documentOf(artifacts))
        : null,
  }),

  fromHint(hreflangSelfHint, {
    scoreMode: 'numeric',
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? hreflangSelf(documentOf(artifacts), pageUrl(artifacts))
        : null,
  }),

  fromHint(hreflangDuplicateHint, {
    scoreMode: 'numeric',
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? hreflangDuplicate(documentOf(artifacts))
        : null,
  }),

  fromHint(alternateMediaHint, {
    scoreMode: 'numeric',
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? alternateMedia(documentOf(artifacts))
        : null,
  }),

  fromHint(paginationRelHint, {
    scoreMode: 'numeric',
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? paginationRel(documentOf(artifacts))
        : null,
  }),
];
