/**
 * Heuristic measurement of how well a page can be chunked by a generative
 * engine, ported from LLMScout's content-extraction check.
 */

/** A text block longer than this with no inner structure is flagged. */
export const UNSTRUCTURED_BLOCK_THRESHOLD = 800;

/** A paragraph or list item must be longer than this to count. */
const PARAGRAPH_MIN_LENGTH = 30;

const HEADINGS = 'h1, h2, h3, h4, h5, h6';

/** The part of a DOM element these readers use. */
interface ElementLike {
  textContent: string;
  querySelectorAll(selector: string): ArrayLike<ElementLike>;
}

/** The part of a DOM document these readers use. */
export interface ContentDocument {
  querySelector(selector: string): ElementLike | null;
}

export interface ContentStats {
  headingCount: number;
  /** Paragraphs and list items with more than 30 characters of text. */
  paragraphCount: number;
  /** Length of the longest `<div>` holding text but no heading, p or li. */
  maxUnstructuredLength: number;
}

/**
 * Measures the `<main>` element (or the body when there is none). Returns
 * null when the document has neither.
 */
export function measureContent(doc: ContentDocument): ContentStats | null {
  const root = doc.querySelector('main') ?? doc.querySelector('body');
  if (root === null) {
    return null;
  }
  const headingCount = root.querySelectorAll(HEADINGS).length;
  const paragraphCount = Array.from(root.querySelectorAll('p, li')).filter(
    (el) => el.textContent.trim().length > PARAGRAPH_MIN_LENGTH,
  ).length;

  let maxUnstructuredLength = 0;
  for (const div of Array.from(root.querySelectorAll('div'))) {
    // A div with headings or paragraphs inside is already structured.
    if (div.querySelectorAll(`${HEADINGS}, p, li`).length === 0) {
      maxUnstructuredLength = Math.max(
        maxUnstructuredLength,
        div.textContent.trim().length,
      );
    }
  }
  return { headingCount, paragraphCount, maxUnstructuredLength };
}
