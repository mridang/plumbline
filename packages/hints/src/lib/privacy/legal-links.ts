/**
 * Finds the links a page gives to its privacy policy and its terms of
 * service. Google's OAuth policy asks that a production app's home page link
 * its privacy policy, and its Branding page requires both links for every
 * external production app; visitors look for the same two links in a footer.
 *
 * A link counts when any of these holds, so a site in another language or
 * with an unusual address still passes:
 *  - it carries the registered link relation (`rel="privacy-policy"` or
 *    `rel="terms-of-service"`, IANA link relations), on `<a>` or `<link>`;
 *  - its text names the page ("Privacy policy", "Datenschutz", "Terms of
 *    use", "AGB", …);
 *  - its address does (`/privacy`, `/datenschutz`, `/terms`, `/tos`, …).
 */
import { finding, type Finding } from '../headers/finding.js';

/** The two legal pages a site is expected to link. */
export type LegalPage = 'privacy-policy' | 'terms-of-service';

/** The slice of a DOM element this reader uses. */
interface ElementLike {
  textContent: string | null;
  getAttribute(name: string): string | null;
}

/** The slice of a DOM document this reader uses. */
export interface DocumentLike {
  querySelectorAll(selector: string): Iterable<ElementLike>;
}

/** Google's App Homepage requirements: the home page links the privacy policy. */
export const PRIVACY_POLICY_LINK_REF =
  'https://support.google.com/cloud/answer/13807376';

/** Google's OAuth App Branding: home page, privacy and terms links are required. */
export const TERMS_OF_SERVICE_LINK_REF =
  'https://support.google.com/cloud/answer/15549049';

/** Words a link's text uses for each page, in the languages most sites use. */
const TEXT: Readonly<Record<LegalPage, RegExp>> = {
  'privacy-policy':
    /\b(privacy|data protection|datenschutz|privacidad|privacidade|confidentialit[eé]|vie priv[eé]e|privacybeleid|riservatezza|integritet|personvern|tietosuoja|prywatno)/i,
  'terms-of-service':
    // eslint-disable-next-line sonarjs/regex-complexity -- one flat list of translated link words; splitting it would change which words match
    /\b(terms|conditions|t\s*&\s*cs?\b|tos\b|agb\b|nutzungsbedingungen|condiciones|termos|gebruiksvoorwaarden|voorwaarden|termini|villkor|vilk[aå]r|k[aä]ytt[oö]ehdot|regulamin)/i,
};

/**
 * Path words that name each page in a link's address. A word must start at a
 * separator, so an article slug such as `/2026-midterms/` is not the terms.
 */
const PATH: Readonly<Record<LegalPage, RegExp>> = {
  'privacy-policy':
    /(privacy|datenschutz|privacidad|privacidade|confidentialite|privacybeleid|riservatezza|integritet|personvern|tietosuoja)/i,
  'terms-of-service':
    // eslint-disable-next-line sonarjs/regex-complexity -- one flat list of translated address words; splitting it would change which addresses match
    /((^|[_.-])(terms|termos|termini|conditions)|^tos([_.-]|$)|(^|[_.-])agb([_.-]|$)|nutzungsbedingungen|condiciones|voorwaarden|villkor|vilkar)/i,
};

/**
 * The longest link text read as naming a legal page. Footer links are a few
 * words; a headline that happens to mention "terms" is not one of them.
 */
const MAX_TEXT_LENGTH = 50;

/** The relation tokens of an element, lower-cased. */
function relsOf(element: ElementLike): string[] {
  return (element.getAttribute('rel') ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * The longest path segment read as naming a legal page: `terms-of-service` or
 * `zalando-privacy-policy` are, an article slug that mentions terms is not.
 */
const MAX_SEGMENT_LENGTH = 40;

/** The short segments of an address's path, without its host, query or fragment. */
function shortSegmentsOf(href: string): string[] {
  let path: string;
  try {
    path = new URL(href, 'https://page.invalid/').pathname;
  } catch {
    return [];
  }
  return path
    .split('/')
    .filter((segment) => segment && segment.length <= MAX_SEGMENT_LENGTH);
}

/** Whether an address is something other than a page (a script, mail, phone). */
function isNotAPage(href: string): boolean {
  return /^(javascript|mailto|tel|data):/i.test(href);
}

/**
 * The address of the page's link to `page`, or undefined when there is none.
 * A link with the registered relation wins; otherwise the first `<a>` with
 * short text that, or whose address, names the page.
 */
export function findLegalLink(
  doc: DocumentLike,
  page: LegalPage,
): string | undefined {
  for (const element of doc.querySelectorAll('a[href], link[href]')) {
    const href = (element.getAttribute('href') ?? '').trim();
    if (href && relsOf(element).includes(page)) {
      return href;
    }
  }
  for (const element of doc.querySelectorAll('a[href]')) {
    const href = (element.getAttribute('href') ?? '').trim();
    const text = (element.textContent ?? '').replaceAll(/\s+/g, ' ').trim();
    if (namesPage(href, text, page)) {
      return href;
    }
  }
  return undefined;
}

/** Whether a link with this address and text reads as the named page. */
function namesPage(href: string, text: string, page: LegalPage): boolean {
  if (!href || href === '#' || isNotAPage(href)) {
    return false;
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return false;
  }
  return (
    TEXT[page].test(text) ||
    shortSegmentsOf(href).some((segment) => PATH[page].test(segment))
  );
}

/** Warning when the page links to no privacy policy. */
export function privacyPolicyLinkMissing(doc: DocumentLike): Finding[] {
  return findLegalLink(doc, 'privacy-policy') === undefined
    ? [
        finding(
          'warning',
          `The page links to no privacy policy. Link it from the home page, for example in the footer, so visitors and app reviewers can find it. Read more: ${PRIVACY_POLICY_LINK_REF}`,
        ),
      ]
    : [];
}

/** Warning when the page links to no terms of service. */
export function termsOfServiceLinkMissing(doc: DocumentLike): Finding[] {
  return findLegalLink(doc, 'terms-of-service') === undefined
    ? [
        finding(
          'warning',
          `The page links to no terms of service. Link them from the home page, for example in the footer, next to the privacy policy. Read more: ${TERMS_OF_SERVICE_LINK_REF}`,
        ),
      ]
    : [];
}
