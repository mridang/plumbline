/**
 * The `seo` check set: every webhint SEO and favicon hint that a Lighthouse
 * *plugin* can run from the artifacts Lighthouse already gathers. Each check
 * reshapes those artifacts into the tiny `DocumentLike` the shared
 * `src/lib/seo/**` readers take (through `../adapt-seo.ts`), then calls the
 * *same single-source rule function* the webhint hint calls
 * (`src/lib/seo/checks.ts`) and returns its findings. The predicate, the exact
 * message and the severity therefore live in one place and cannot drift between
 * the hint and this check.
 *
 * Eighteen hints are covered: the title rules (missing/too-long/too-short), the
 * meta-description rules (missing/too-long/too-short), the `<h1>` rules
 * (missing/multiple), `<html lang>`, the robots meta rules (noindex/nofollow),
 * the canonical rules (missing/mismatch), JSON-LD structured data, and the four
 * favicon rules (missing/ico-or-png/32x32/svg).
 *
 * Where the facts come from (see `../adapt-seo.ts` for the full rationale):
 *   - meta description and robots metas: the parsed `MetaElements` artifact.
 *   - the canonical link: the parsed `LinkElements` artifact.
 *   - the `<title>` text, the count of `<h1>`, the `<html lang>` attribute, the
 *     favicon `<link>`s (Lighthouse's `LinkElements` omit `type`/`sizes`) and
 *     the JSON-LD `<script>` contents (Lighthouse exposes no inline-script
 *     contents artifact): parsed out of the raw `MainDocumentContent` HTML,
 *     which is the only source Lighthouse gathers by default for them.
 *   - the `X-Robots-Tag` response header: the main document's response headers,
 *     read through the shared `NetworkRecords` seam (`../network.ts`).
 *
 * Titles, descriptions, references and the section are pulled from the compiled
 * webhint hint metadata (`../meta.ts`), never restated here.
 *
 * Scoring. A check is graded (`numeric`) when it is a genuine quality gate the
 * webhint hint treats as a problem (its finding severity is `error` or
 * `warning`) *and* a homepage plugin run can reproduce it fully from the DOM.
 * Everything else is `informative` — surfaced but never scored — which covers
 * the information-level hints (webhint `Severity.hint`) and the two favicon
 * rules (`icons-favicon-missing`, `icons-favicon-ico-or-png-missing`) whose
 * webhint check also falls back to fetching `/favicon.ico`, a request a plugin
 * cannot make, so only the declared `<link>`s are inspected here.
 */
import type { Artifacts } from 'lighthouse';
import type { HintDefinition } from '@mridang/webhint-hint-plumbline/dist/core/define-hint.js';
import type { DocumentLike } from '@mridang/webhint-hint-plumbline/dist/lib/seo/read.js';
// The single-source SEO/favicon rules: predicate + message + severity. Both
// this check and the webhint hints call these, so neither restates the wording.
import {
  canonicalMismatch,
  canonicalMissing,
  favicon32Missing,
  faviconIcoOrPngMissing,
  faviconMissing,
  faviconSvgMissing,
  h1Missing,
  h1Multiple,
  htmlLangMissing,
  metaDescriptionMissing,
  metaDescriptionTooLong,
  metaDescriptionTooShort,
  robotsNofollow,
  robotsNoindex,
  structuredDataMissing,
  titleMissing,
  titleTooLong,
  titleTooShort,
} from '@mridang/webhint-hint-plumbline/dist/lib/seo/checks.js';
import { mainResponse } from '../network.js';
import {
  httpHeadersFromBag,
  seoDocument,
  type LinkElementArtifact,
} from '../adapt-seo.js';
import { hintDocs } from '../meta.js';
import type { AuditCheck } from './types.js';

// The compiled webhint hints, imported only for their metadata (name,
// description, reference, section); their check logic is reused through the
// `src/lib/seo/**` rule functions above, not through these modules.
import seoTitleMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/seo-title-missing.js';
import seoTitleTooLongHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/seo-title-too-long.js';
import seoTitleTooShortHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/seo-title-too-short.js';
import seoMetaDescriptionMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/seo-meta-description-missing.js';
import seoMetaDescriptionTooLongHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/seo-meta-description-too-long.js';
import seoMetaDescriptionTooShortHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/seo-meta-description-too-short.js';
import seoH1MissingHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/seo-h1-missing.js';
import seoH1MultipleHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/seo-h1-multiple.js';
import seoHtmlLangMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/seo-html-lang-missing.js';
import seoRobotsNoindexHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/seo-robots-noindex.js';
import seoRobotsNofollowHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/seo-robots-nofollow.js';
import seoCanonicalMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/seo-canonical-missing.js';
import seoCanonicalMismatchHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/seo-canonical-mismatch.js';
import seoStructuredDataMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/seo-structured-data-missing.js';
import iconsFaviconMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/icons-favicon-missing.js';
import iconsFaviconIcoOrPngMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/icons-favicon-ico-or-png-missing.js';
import iconsFavicon32MissingHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/icons-favicon-32-missing.js';
import iconsFaviconSvgMissingHint from '@mridang/webhint-hint-plumbline/dist/hints/seo/icons-favicon-svg-missing.js';

/** The artifact sets the SEO checks read, named for the rule that reads them. */
const HTML_ONLY = ['MainDocumentContent', 'URL'] as const;
const META_ONLY = ['MetaElements'] as const;
const LINKS_ONLY = ['LinkElements'] as const;
const LINKS_AND_URL = ['LinkElements', 'URL'] as const;
// The robots rules read the robots metas *and* the `X-Robots-Tag` header.
const ROBOTS_ARTIFACTS = ['MetaElements', 'DevtoolsLog', 'URL'] as const;

/** The page URL a check compares against (the rendered URL, else the requested). */
function pageUrl(artifacts: Artifacts): string {
  return (
    artifacts.URL?.finalDisplayedUrl || artifacts.URL?.mainDocumentUrl || ''
  );
}

/**
 * Builds the {@link DocumentLike} the readers query from whatever DOM artifacts
 * the run carries. Missing artifacts default to empty, so a check that reads
 * only one of them never trips over the absence of another. The page URL is
 * threaded through so the HTML parser can resolve relative URLs.
 */
function documentOf(artifacts: Artifacts): DocumentLike {
  return seoDocument({
    MetaElements: artifacts.MetaElements ?? [],
    LinkElements: (artifacts.LinkElements ??
      []) as readonly LinkElementArtifact[],
    MainDocumentContent: artifacts.MainDocumentContent ?? '',
    url: pageUrl(artifacts),
  });
}

/**
 * Builds a check that borrows its metadata from a compiled webhint hint. The
 * title, description, reference and section are taken from the hint and never
 * restated; the `run` body is supplied by the caller and reuses the shared
 * `src/lib/seo/checks.ts` rule function, so the finding message matches the
 * webhint hint's byte for byte.
 */
function fromHint(
  definition: HintDefinition,
  config: {
    scoreMode: AuditCheck['scoreMode'];
    requiredArtifacts: readonly string[];
    run: AuditCheck['run'];
  },
): AuditCheck {
  const docs = hintDocs(definition);
  return {
    id: definition.id,
    // Every SEO/favicon hint is placed in the taxonomy, so `section` is always
    // set; fall back to the seo section defensively rather than emit none.
    section: docs.section ?? 'seo',
    title: docs.name,
    description: docs.description,
    reference: docs.url,
    scoreMode: config.scoreMode,
    requiredArtifacts: config.requiredArtifacts,
    run: config.run,
  };
}

/** The 18 SEO checks, in the order the webhint `seo` set lists them. */
export const seoChecks: readonly AuditCheck[] = [
  // ---- Title -------------------------------------------------------------
  fromHint(seoTitleMissingHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HTML_ONLY,
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? titleMissing(documentOf(artifacts))
        : null,
  }),

  fromHint(seoTitleTooLongHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HTML_ONLY,
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? titleTooLong(documentOf(artifacts))
        : null,
  }),

  fromHint(seoTitleTooShortHint, {
    scoreMode: 'informative',
    requiredArtifacts: HTML_ONLY,
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? titleTooShort(documentOf(artifacts))
        : null,
  }),

  // ---- Meta description --------------------------------------------------
  fromHint(seoMetaDescriptionMissingHint, {
    scoreMode: 'numeric',
    requiredArtifacts: META_ONLY,
    run: (artifacts) =>
      artifacts.MetaElements
        ? metaDescriptionMissing(documentOf(artifacts))
        : null,
  }),

  fromHint(seoMetaDescriptionTooLongHint, {
    scoreMode: 'informative',
    requiredArtifacts: META_ONLY,
    run: (artifacts) =>
      artifacts.MetaElements
        ? metaDescriptionTooLong(documentOf(artifacts))
        : null,
  }),

  fromHint(seoMetaDescriptionTooShortHint, {
    scoreMode: 'informative',
    requiredArtifacts: META_ONLY,
    run: (artifacts) =>
      artifacts.MetaElements
        ? metaDescriptionTooShort(documentOf(artifacts))
        : null,
  }),

  // ---- Headings ----------------------------------------------------------
  fromHint(seoH1MissingHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HTML_ONLY,
    run: (artifacts) =>
      artifacts.MainDocumentContent ? h1Missing(documentOf(artifacts)) : null,
  }),

  fromHint(seoH1MultipleHint, {
    scoreMode: 'informative',
    requiredArtifacts: HTML_ONLY,
    run: (artifacts) =>
      artifacts.MainDocumentContent ? h1Multiple(documentOf(artifacts)) : null,
  }),

  // ---- Language ----------------------------------------------------------
  fromHint(seoHtmlLangMissingHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HTML_ONLY,
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? htmlLangMissing(documentOf(artifacts))
        : null,
  }),

  // ---- Robots ------------------------------------------------------------
  fromHint(seoRobotsNoindexHint, {
    scoreMode: 'numeric',
    requiredArtifacts: ROBOTS_ARTIFACTS,
    run: async (artifacts, context) => {
      if (!artifacts.MetaElements) {
        return null;
      }
      // The header is best-effort: a run with no document record simply has no
      // `X-Robots-Tag`, and the robots meta still decides the finding.
      const main = await mainResponse(artifacts, context);
      const headers = httpHeadersFromBag(main?.headers);
      return robotsNoindex(documentOf(artifacts), headers);
    },
  }),

  fromHint(seoRobotsNofollowHint, {
    scoreMode: 'informative',
    requiredArtifacts: ROBOTS_ARTIFACTS,
    run: async (artifacts, context) => {
      if (!artifacts.MetaElements) {
        return null;
      }
      const main = await mainResponse(artifacts, context);
      const headers = httpHeadersFromBag(main?.headers);
      return robotsNofollow(documentOf(artifacts), headers);
    },
  }),

  // ---- Canonical ---------------------------------------------------------
  fromHint(seoCanonicalMissingHint, {
    scoreMode: 'informative',
    requiredArtifacts: LINKS_ONLY,
    run: (artifacts) =>
      artifacts.LinkElements ? canonicalMissing(documentOf(artifacts)) : null,
  }),

  fromHint(seoCanonicalMismatchHint, {
    scoreMode: 'informative',
    requiredArtifacts: LINKS_AND_URL,
    run: (artifacts) =>
      artifacts.LinkElements
        ? canonicalMismatch(documentOf(artifacts), pageUrl(artifacts))
        : null,
  }),

  // ---- Structured data ---------------------------------------------------
  fromHint(seoStructuredDataMissingHint, {
    scoreMode: 'informative',
    requiredArtifacts: HTML_ONLY,
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? structuredDataMissing(documentOf(artifacts))
        : null,
  }),

  // ---- Favicons ----------------------------------------------------------
  // `icons-favicon-missing` and `icons-favicon-ico-or-png-missing` fall back in
  // webhint to fetching `/favicon.ico`; a plugin cannot make that request, so
  // only the declared `<link>`s are inspected and both are informative.
  fromHint(iconsFaviconMissingHint, {
    scoreMode: 'informative',
    requiredArtifacts: HTML_ONLY,
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? faviconMissing(documentOf(artifacts))
        : null,
  }),

  fromHint(iconsFaviconIcoOrPngMissingHint, {
    scoreMode: 'informative',
    requiredArtifacts: HTML_ONLY,
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? faviconIcoOrPngMissing(documentOf(artifacts))
        : null,
  }),

  fromHint(iconsFavicon32MissingHint, {
    scoreMode: 'informative',
    requiredArtifacts: HTML_ONLY,
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? favicon32Missing(documentOf(artifacts))
        : null,
  }),

  fromHint(iconsFaviconSvgMissingHint, {
    scoreMode: 'informative',
    requiredArtifacts: HTML_ONLY,
    run: (artifacts) =>
      artifacts.MainDocumentContent
        ? faviconSvgMissing(documentOf(artifacts))
        : null,
  }),
];
