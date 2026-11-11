/**
 * Single-source predicates and message text for the `geo` rules. Each function
 * takes the value one of the `src/lib/geo/**` logic functions already produced
 * (the {@link JsonLdBlocks} from `readJsonLd`, or the {@link ContentStats} from
 * `measureContent`) and turns it into the findings a rule reports, message and
 * severity included.
 *
 * Both sides of the project call these: the webhint hint in
 * `src/hints/geo/*` (which additionally picks the DOM element each finding
 * points at and attaches its example `codeSnippet`) and the Lighthouse check in
 * `lighthouse/src/checks/geo.ts`. Writing each message once here means the two
 * surfaces can never drift.
 */
import { finding, type Finding } from '../headers/finding.js';
import {
  type JsonLdBlocks,
  containsSpeakable,
  containsType,
  ENTITY_TYPE_LABEL,
  findEntityNode,
  hasNonEmptySameAs,
} from './json-ld.js';
import { type ContentStats, UNSTRUCTURED_BLOCK_THRESHOLD } from './content.js';

/** The source link the LLMScout geo rules append to every message. */
export const REF = 'https://github.com/RudrenduPaul/LLMScout';

/**
 * Errors when any JSON-LD block does not parse as JSON (an empty block counts
 * as invalid). `blocks` is `readJsonLd(doc)`. Pages with no JSON-LD at all are
 * left to seo-structured-data-missing, so a zero-block page reports nothing.
 */
export function structuredDataInvalidFindings(blocks: JsonLdBlocks): Finding[] {
  const { total, invalid } = blocks;
  if (invalid > 0) {
    return [
      finding(
        'error',
        `${invalid} of ${total} JSON-LD block(s) contain invalid JSON. Fix the malformed JSON-LD block(s) so they parse as valid JSON. Read more: ${REF}`,
      ),
    ];
  }
  return [];
}

/**
 * Warns when no FAQPage node is present anywhere in the parsed JSON-LD (arrays
 * and `@graph` included). `blocks` is `readJsonLd(doc)`.
 */
export function faqSchemaFindings(blocks: JsonLdBlocks): Finding[] {
  if (!blocks.parsed.some((data) => containsType(data, 'FAQPage'))) {
    return [
      finding(
        'warning',
        `No FAQPage structured data found. If this page has an FAQ section, mark it up with FAQPage JSON-LD so generative engines can surface individual answers. Read more: ${REF}`,
      ),
    ];
  }
  return [];
}

/**
 * Warns when no SpeakableSpecification node, and no node with a truthy
 * `speakable` property, is present in the parsed JSON-LD. `blocks` is
 * `readJsonLd(doc)`.
 */
export function speakableSchemaFindings(blocks: JsonLdBlocks): Finding[] {
  if (!blocks.parsed.some((block) => containsSpeakable(block))) {
    return [
      finding(
        'warning',
        `No Speakable structured data found. If this page has content suited for voice assistants, add a "speakable" SpeakableSpecification to its JSON-LD so voice search can surface it. Read more: ${REF}`,
      ),
    ];
  }
  return [];
}

/**
 * Warns when the parsed JSON-LD has no Organization/Person entity node, or when
 * the first such node has no non-empty `sameAs`. `blocks` is `readJsonLd(doc)`;
 * the first entity found across all blocks is the one judged, matching the hint.
 */
export function organizationSchemaFindings(blocks: JsonLdBlocks): Finding[] {
  let entity: Record<string, unknown> | null = null;
  for (const data of blocks.parsed) {
    entity = findEntityNode(data);
    if (entity) {
      break;
    }
  }
  if (!entity) {
    return [
      finding(
        'warning',
        `No ${ENTITY_TYPE_LABEL} structured data found. Add Organization (or Person) JSON-LD with a sameAs array of your official social/profile URLs to strengthen Knowledge Panel signals. Read more: ${REF}`,
      ),
    ];
  }
  if (!hasNonEmptySameAs(entity)) {
    return [
      finding(
        'warning',
        `The ${ENTITY_TYPE_LABEL} structured data has no sameAs property. Add a sameAs array of your official social/profile URLs. Read more: ${REF}`,
      ),
    ];
  }
  return [];
}

/**
 * Warns when `<main>`/`<body>` has no heading or paragraph structure, or holds
 * a single unstructured block over the threshold. `stats` is
 * `measureContent(doc)`; the caller skips the rule when that returned null
 * (there was no root to measure).
 */
export function contentExtractionFindings(stats: ContentStats): Finding[] {
  if (stats.headingCount === 0 && stats.paragraphCount === 0) {
    return [
      finding(
        'warning',
        `No headings or paragraph-level structure detected; a generative engine may struggle to extract distinct sections from this page. Break content into headings (<h2>, <h3>, ...) and paragraphs (<p>) rather than unstructured text. Read more: ${REF}`,
      ),
    ];
  }
  if (stats.maxUnstructuredLength > UNSTRUCTURED_BLOCK_THRESHOLD) {
    return [
      finding(
        'warning',
        `Found a ${stats.maxUnstructuredLength}-character block of text with no internal heading or paragraph structure. Break large unstructured blocks into headed sections and paragraphs. Read more: ${REF}`,
      ),
    ];
  }
  return [];
}
