/**
 * The `richresults` check set: schema.org JSON-LD validated against Google's
 * rich-results requirements, read from the served HTML. Each check parses the
 * `MainDocumentContent` artifact once (via `geoDocument` in `../adapt-geo.ts`,
 * the same `@hint/utils-dom` parser the webhint hints use), reads the JSON-LD
 * with the shared `readJsonLd` from the geo library, and hands the parsed
 * blocks to the shared `src/lib/richresults/checks.js` validator for that type.
 * Those same validator functions back the webhint hints, so the finding text is
 * written once and a page yields the same findings here as under the hint.
 *
 * Lighthouse exposes no parsed artifact for JSON-LD blocks (the debugger's
 * `Scripts` artifact sees only executable JavaScript, not `application/ld+json`),
 * so every check reads the served HTML. Titles, descriptions and references
 * come from the compiled hint metadata (`../meta.ts`); the message text comes
 * from the shared validators, so nothing is restated here. All ten checks live
 * in the `seo` section. A check that validates required fields is graded
 * (`numeric`); the recommended-only Article check is `informative`.
 */
import type { Artifacts } from 'lighthouse';
import type { HintDefinition } from '@mridang/webhint-hint-plumbline/dist/core/define-hint.js';
import { readJsonLd } from '@mridang/webhint-hint-plumbline/dist/lib/geo/json-ld.js';
import type { JsonLdBlocks } from '@mridang/webhint-hint-plumbline/dist/lib/geo/json-ld.js';
import type { Finding } from '@mridang/webhint-hint-plumbline/dist/lib/headers/finding.js';
import {
  articleFindings,
  breadcrumbFindings,
  eventFindings,
  jobPostingFindings,
  localBusinessFindings,
  productFindings,
  recipeFindings,
  reviewFindings,
  videoFindings,
  websiteSearchActionFindings,
} from '@mridang/webhint-hint-plumbline/dist/lib/richresults/checks.js';
import { geoDocument } from '../adapt-geo.js';
import { hintDocs } from '../meta.js';
import type { AuditCheck } from './types.js';
import type { ScoreMode } from '../result.js';

// The compiled webhint hints, imported only for their metadata (name,
// description, reference); their check logic is reused through the shared
// `src/lib/richresults/**` validators above, not through these modules.
import recipeHint from '@mridang/webhint-hint-plumbline/dist/hints/richresults/richresults-recipe.js';
import productHint from '@mridang/webhint-hint-plumbline/dist/hints/richresults/richresults-product.js';
import articleHint from '@mridang/webhint-hint-plumbline/dist/hints/richresults/richresults-article.js';
import breadcrumbHint from '@mridang/webhint-hint-plumbline/dist/hints/richresults/richresults-breadcrumb.js';
import eventHint from '@mridang/webhint-hint-plumbline/dist/hints/richresults/richresults-event.js';
import videoHint from '@mridang/webhint-hint-plumbline/dist/hints/richresults/richresults-video.js';
import jobpostingHint from '@mridang/webhint-hint-plumbline/dist/hints/richresults/richresults-jobposting.js';
import localbusinessHint from '@mridang/webhint-hint-plumbline/dist/hints/richresults/richresults-localbusiness.js';
import reviewHint from '@mridang/webhint-hint-plumbline/dist/hints/richresults/richresults-review.js';
import websiteSearchactionHint from '@mridang/webhint-hint-plumbline/dist/hints/richresults/richresults-website-searchaction.js';

/** The page URL the document is parsed against (unused by these checks). */
function pageUrl(artifacts: Artifacts): string {
  return (
    artifacts.URL?.finalDisplayedUrl || artifacts.URL?.mainDocumentUrl || ''
  );
}

/**
 * Builds a check from a compiled webhint hint and its shared validator. The
 * title, description and reference are taken from the hint, so they are never
 * restated here. Every richresults check lands in the `seo` section, read from the hint
 * metadata (with `seo` as the fallback).
 */
function fromHint(
  definition: HintDefinition,
  scoreMode: ScoreMode,
  validate: (blocks: JsonLdBlocks) => readonly Finding[],
): AuditCheck {
  const docs = hintDocs(definition);
  return {
    id: definition.id,
    section: docs.section ?? 'seo',
    title: docs.name,
    description: docs.description,
    reference: docs.url,
    scoreMode,
    requiredArtifacts: ['MainDocumentContent', 'URL'],
    run: (artifacts) => {
      const html = artifacts.MainDocumentContent;
      if (!html) {
        return null;
      }
      return validate(readJsonLd(geoDocument(html, pageUrl(artifacts))));
    },
  };
}

/** The ten richresults checks, in report order (matching the hint set). */
export const richresultsChecks: readonly AuditCheck[] = [
  fromHint(recipeHint, 'numeric', recipeFindings),
  fromHint(productHint, 'numeric', productFindings),
  // Article has no Google-required properties, only recommended ones.
  fromHint(articleHint, 'informative', articleFindings),
  fromHint(breadcrumbHint, 'numeric', breadcrumbFindings),
  fromHint(eventHint, 'numeric', eventFindings),
  fromHint(videoHint, 'numeric', videoFindings),
  fromHint(jobpostingHint, 'numeric', jobPostingFindings),
  fromHint(localbusinessHint, 'numeric', localBusinessFindings),
  fromHint(reviewHint, 'numeric', reviewFindings),
  fromHint(websiteSearchactionHint, 'numeric', websiteSearchActionFindings),
];
