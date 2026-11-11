/**
 * The `geo` check set: the LLMScout-derived generative-engine-optimisation
 * hints a Lighthouse *plugin* can run from the served HTML. Each check parses
 * the `MainDocumentContent` artifact once (via `geoDocument` in
 * `../adapt-geo.ts`, which uses `@hint/utils-dom`'s `createHTMLDocument`), feeds
 * that document to the shared `src/lib/geo/**` logic function, and hands the
 * result to the shared predicate-and-message function in
 * `@mridang/webhint-hint-plumbline/dist/lib/geo/checks.js`. Those same `checks.js` functions back the
 * webhint hints, so the finding text is written once and a page yields the same
 * findings here as under the hint.
 *
 * Five hints are covered: geo-structured-data-invalid, geo-faq-schema,
 * geo-speakable-schema, geo-organization-schema and geo-content-extraction.
 * All of them read the served HTML, because Lighthouse exposes no parsed
 * artifact for JSON-LD blocks (the debugger's `Scripts` artifact sees only
 * executable JavaScript, not `application/ld+json`) or for body structure.
 *
 * Titles, descriptions, references and sections come from the compiled hint
 * metadata (`../meta.ts`); the message text comes from the shared `checks.js`
 * functions, so nothing is restated here. All five land in the seo section
 * per the taxonomy (the four AI-facing ones carry the `ai` tag). Every check is graded (`numeric`).
 */
import type * as LH from 'lighthouse';
import type { HintDefinition } from '@mridang/webhint-hint-plumbline/dist/core/define-hint.js';
import { readJsonLd } from '@mridang/webhint-hint-plumbline/dist/lib/geo/json-ld.js';
import { measureContent } from '@mridang/webhint-hint-plumbline/dist/lib/geo/content.js';
// The predicate-and-message functions shared with the webhint hints. Both
// surfaces call these, so a rule's wording lives in exactly one place.
import {
  contentExtractionFindings,
  faqSchemaFindings,
  organizationSchemaFindings,
  speakableSchemaFindings,
  structuredDataInvalidFindings,
} from '@mridang/webhint-hint-plumbline/dist/lib/geo/checks.js';
import { geoDocument } from '../adapt-geo.js';
import { hintDocs } from '../meta.js';
import type { AuditCheck } from './types.js';

// The compiled webhint hints, imported only for their metadata (name,
// description, reference, section); their check logic is reused through the
// `src/lib/geo/**` functions above, not through these modules.
import contentExtractionHint from '@mridang/webhint-hint-plumbline/dist/hints/geo/geo-content-extraction.js';
import faqSchemaHint from '@mridang/webhint-hint-plumbline/dist/hints/geo/geo-faq-schema.js';
import organizationSchemaHint from '@mridang/webhint-hint-plumbline/dist/hints/geo/geo-organization-schema.js';
import speakableSchemaHint from '@mridang/webhint-hint-plumbline/dist/hints/geo/geo-speakable-schema.js';
import structuredDataInvalidHint from '@mridang/webhint-hint-plumbline/dist/hints/geo/geo-structured-data-invalid.js';

/** The page URL the document is parsed against (unused by these checks). */
function pageUrl(artifacts: LH.Artifacts): string {
  return (
    artifacts.URL?.finalDisplayedUrl || artifacts.URL?.mainDocumentUrl || ''
  );
}

/**
 * Builds a check that borrows its metadata from a compiled webhint hint. The
 * title, description, reference and section are taken from the hint, so they
 * are never restated here. (Local to the set, mirroring `headers.ts`.).
 */
function fromHint(
  definition: HintDefinition,
  config: Pick<AuditCheck, 'scoreMode' | 'run'> & {
    requiredArtifacts: readonly string[];
  },
): AuditCheck {
  const docs = hintDocs(definition);
  return {
    id: definition.id,
    // Every geo hint is placed in the taxonomy; fall back to the LLMs-and-AI
    // section defensively rather than emit an empty group.
    section: docs.section ?? 'ai',
    title: docs.name,
    description: docs.description,
    reference: docs.url,
    scoreMode: config.scoreMode,
    requiredArtifacts: config.requiredArtifacts,
    run: config.run,
  };
}

/** The five geo checks, in report order. */
export const geoChecks: readonly AuditCheck[] = [
  // JSON-LD blocks that do not parse as valid JSON (an empty block counts).
  // Pages with no JSON-LD at all are left to seo-structured-data-missing.
  fromHint(structuredDataInvalidHint, {
    scoreMode: 'numeric',
    requiredArtifacts: ['MainDocumentContent', 'URL'],
    run: (artifacts) => {
      const html = artifacts.MainDocumentContent;
      if (!html) {
        return null;
      }
      return structuredDataInvalidFindings(
        readJsonLd(geoDocument(html, pageUrl(artifacts))),
      );
    },
  }),

  // A FAQPage node anywhere in the JSON-LD (arrays and @graph included).
  fromHint(faqSchemaHint, {
    scoreMode: 'numeric',
    requiredArtifacts: ['MainDocumentContent', 'URL'],
    run: (artifacts) => {
      const html = artifacts.MainDocumentContent;
      if (!html) {
        return null;
      }
      return faqSchemaFindings(
        readJsonLd(geoDocument(html, pageUrl(artifacts))),
      );
    },
  }),

  // A SpeakableSpecification node, or any node with a truthy `speakable`.
  fromHint(speakableSchemaHint, {
    scoreMode: 'numeric',
    requiredArtifacts: ['MainDocumentContent', 'URL'],
    run: (artifacts) => {
      const html = artifacts.MainDocumentContent;
      if (!html) {
        return null;
      }
      return speakableSchemaFindings(
        readJsonLd(geoDocument(html, pageUrl(artifacts))),
      );
    },
  }),

  // An Organization/Person entity node, and whether it links profiles via a
  // non-empty sameAs. The first entity found across all blocks is judged.
  fromHint(organizationSchemaHint, {
    scoreMode: 'numeric',
    requiredArtifacts: ['MainDocumentContent', 'URL'],
    run: (artifacts) => {
      const html = artifacts.MainDocumentContent;
      if (!html) {
        return null;
      }
      return organizationSchemaFindings(
        readJsonLd(geoDocument(html, pageUrl(artifacts))),
      );
    },
  }),

  // A heuristic for how well a generative engine can chunk the page. Reports
  // when <main>/<body> has no heading or paragraph structure, or holds an
  // oversized unstructured block. Not applicable when there is no body at all.
  fromHint(contentExtractionHint, {
    scoreMode: 'numeric',
    requiredArtifacts: ['MainDocumentContent', 'URL'],
    run: (artifacts) => {
      const html = artifacts.MainDocumentContent;
      if (!html) {
        return null;
      }
      const stats = measureContent(geoDocument(html, pageUrl(artifacts)));
      if (!stats) {
        // The document had neither a <main> nor a <body> to measure.
        return null;
      }
      return contentExtractionFindings(stats);
    },
  }),
];
