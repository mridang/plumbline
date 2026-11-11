/**
 * Single-source Progressive-Web-App rules. Each rule owns three things so they
 * cannot drift between the webhint hint (`src/hints/pwa/<id>.ts`) and the
 * Lighthouse check (`lighthouse/src/checks/pwa.ts`): the predicate (when the
 * rule fails), the exact message shown to the user (including its `Read more:`
 * link), and the finding severity. Every rule is a pure function returning a
 * {@link Finding}[] (empty when the page passes).
 *
 * There are two kinds of rule here:
 *   - DOM rules (`manifestLinked`, `themeColorMeta`) read the parsed page
 *     through the `./read.ts` readers. Both the webhint hint and the Lighthouse
 *     plugin call them, so the two can never diverge.
 *   - Manifest rules (`manifestValid`, `manifestIcons`) read the fetched
 *     manifest JSON and its response media type. Only webhint fetches the
 *     manifest, so these are called solely by the webhint hints; Lighthouse
 *     gathers no manifest body by default.
 *
 * The rules validate the manifest faithfully against the W3C Web App Manifest
 * spec (https://www.w3.org/TR/appmanifest/): the members the browser install
 * criteria need are required (severity `error`), and the members the spec
 * recommends for a complete manifest are informative (severity `hint`). A
 * served manifest with the wrong media type, or a colour that is not a valid
 * CSS colour, is advice (severity `warning`): browsers are lenient about both.
 */
import { finding, type Finding } from '../headers/finding.js';
import {
  getManifestHref,
  getThemeColorMeta,
  isAbsoluteHref,
  type DocumentLike,
} from './read.js';
import {
  DISPLAY_VALUES,
  hasMember,
  hasNonEmptyArray,
  hasPngIconOfSize,
  isValidColor,
  isValidDisplay,
  MANIFEST_MEDIA_TYPE,
  parseManifest,
  readIcons,
  readString,
} from './manifest.js';

// ---- Reference links (shared with each hint's `reference` metadata) --------
export const MANIFEST_LINKED_REF = 'https://www.w3.org/TR/appmanifest/#linking';
export const MANIFEST_VALID_REF = 'https://www.w3.org/TR/appmanifest/';
export const MANIFEST_ICONS_REF =
  'https://www.w3.org/TR/appmanifest/#icons-member';
export const THEME_COLOR_META_REF =
  'https://web.dev/articles/add-manifest#theme-color';

// ---- DOM: the manifest link and the theme-color meta -----------------------

/**
 * Error when the page links no Web App Manifest, and a warning when the link's
 * `href` is a document-relative reference rather than an absolute one. Without
 * a `<link rel="manifest">` a browser never fetches the manifest, so the app
 * cannot be installed; a relative `href` resolves differently depending on the
 * page it is served from, which breaks the link on nested routes.
 */
export function manifestLinked(doc: DocumentLike): Finding[] {
  const href = getManifestHref(doc);
  if (href === null) {
    return [
      finding(
        'error',
        `The page links no Web App Manifest. Add <link rel="manifest" href="/manifest.webmanifest"> to the <head> so the app can be installed. Read more: ${MANIFEST_LINKED_REF}`,
      ),
    ];
  }
  if (!isAbsoluteHref(href)) {
    return [
      finding(
        'warning',
        `The manifest link href "${href}" is document-relative; use an absolute path such as "/manifest.webmanifest" so it resolves on every route. Read more: ${MANIFEST_LINKED_REF}`,
      ),
    ];
  }
  return [];
}

/**
 * Hint when the page declares no `<meta name="theme-color">`. The meta themes
 * the browser toolbar and address bar as soon as the page loads (before the
 * manifest is fetched), so it complements the manifest's `theme_color`.
 */
export function themeColorMeta(doc: DocumentLike): Finding[] {
  if (getThemeColorMeta(doc) === null) {
    return [
      finding(
        'hint',
        `No <meta name="theme-color"> found. Add one, for example <meta name="theme-color" content="#ffffff">, to theme the browser UI. Read more: ${THEME_COLOR_META_REF}`,
      ),
    ];
  }
  return [];
}

// ---- Manifest (fetched JSON): validity and members -------------------------

/**
 * Validates the fetched manifest against the W3C spec and the install criteria.
 * `mediaType` is the response's media type (for the `application/manifest+json`
 * check). Reports, in order: an unparsable body; the wrong media type; each
 * required member that is missing or invalid (a name, a start URL, a valid
 * `display`, a non-empty `icons` member, and valid theme/background colours);
 * and each recommended member that is absent. The specific 192/512 PNG icon
 * requirement is `manifestIcons`, so this only checks that `icons` is present.
 */
export function manifestValid(text: string, mediaType: string): Finding[] {
  const manifest = parseManifest(text);
  if (manifest === null) {
    return [
      finding(
        'error',
        `The manifest is not valid JSON (or is not a JSON object). A Web App Manifest must be a JSON object. Read more: ${MANIFEST_VALID_REF}`,
      ),
    ];
  }

  const findings: Finding[] = [];

  // The media type the manifest is served as. Browsers accept other types, so
  // this is advice, not a hard failure.
  if (mediaType.trim().toLowerCase() !== MANIFEST_MEDIA_TYPE) {
    findings.push(
      finding(
        'warning',
        `The manifest is served as "${mediaType || 'no media type'}" but should be "${MANIFEST_MEDIA_TYPE}". Read more: ${MANIFEST_VALID_REF}`,
      ),
    );
  }

  // Required members (install criteria) ------------------------------------
  // A name: either `name` or `short_name` must be present.
  if (
    readString(manifest, 'name') === null &&
    readString(manifest, 'short_name') === null
  ) {
    findings.push(
      finding(
        'error',
        `The manifest has no "name" or "short_name"; add at least one so the installed app has a label. Read more: ${MANIFEST_VALID_REF}`,
      ),
    );
  }

  // A start URL to open when the app launches.
  if (readString(manifest, 'start_url') === null) {
    findings.push(
      finding(
        'error',
        `The manifest has no "start_url"; add the URL the app should open at when launched. Read more: ${MANIFEST_VALID_REF}`,
      ),
    );
  }

  // A display mode, which must be one of the spec's values.
  if (!hasMember(manifest, 'display')) {
    findings.push(
      finding(
        'error',
        `The manifest has no "display"; set it to one of ${DISPLAY_VALUES.join(', ')}. Read more: ${MANIFEST_VALID_REF}`,
      ),
    );
  }
  if (hasMember(manifest, 'display') && !isValidDisplay(manifest.display)) {
    findings.push(
      finding(
        'error',
        `The manifest "display" is invalid; it must be one of ${DISPLAY_VALUES.join(', ')}. Read more: ${MANIFEST_VALID_REF}`,
      ),
    );
  }

  // An icons member (the specific sizes are checked by `manifestIcons`).
  if (!hasNonEmptyArray(manifest, 'icons')) {
    findings.push(
      finding(
        'error',
        `The manifest has no "icons"; add an icons array with at least a 192x192 and a 512x512 PNG. Read more: ${MANIFEST_VALID_REF}`,
      ),
    );
  }

  // A theme colour and a background colour, each a valid CSS colour.
  if (!hasMember(manifest, 'theme_color')) {
    findings.push(
      finding(
        'error',
        `The manifest has no "theme_color"; add one so the browser UI is themed when the app is installed. Read more: ${MANIFEST_VALID_REF}`,
      ),
    );
  }
  if (
    hasMember(manifest, 'theme_color') &&
    !isValidColor(manifest.theme_color)
  ) {
    findings.push(
      finding(
        'warning',
        `The manifest "theme_color" is not a valid CSS colour. Read more: ${MANIFEST_VALID_REF}`,
      ),
    );
  }

  if (!hasMember(manifest, 'background_color')) {
    findings.push(
      finding(
        'error',
        `The manifest has no "background_color"; add one so the splash screen has a background before the app paints. Read more: ${MANIFEST_VALID_REF}`,
      ),
    );
  }
  if (
    hasMember(manifest, 'background_color') &&
    !isValidColor(manifest.background_color)
  ) {
    findings.push(
      finding(
        'warning',
        `The manifest "background_color" is not a valid CSS colour. Read more: ${MANIFEST_VALID_REF}`,
      ),
    );
  }

  // Recommended members (informational) ------------------------------------
  const recommended: ReadonlyArray<{ key: string; advice: string }> = [
    {
      key: 'id',
      advice:
        'add "id" to give the app a stable identity across start-URL changes',
    },
    {
      key: 'scope',
      advice:
        'add "scope" to bound the URLs that open inside the installed app',
    },
    {
      key: 'shortcuts',
      advice: 'add "shortcuts" to offer quick actions from the app icon',
    },
    {
      key: 'screenshots',
      advice: 'add "screenshots" so the richer install dialog can be shown',
    },
    {
      key: 'description',
      advice: 'add "description" to describe the app in install UI',
    },
  ];
  for (const { key, advice } of recommended) {
    const present =
      key === 'shortcuts' || key === 'screenshots'
        ? hasNonEmptyArray(manifest, key)
        : hasMember(manifest, key);
    if (!present) {
      findings.push(
        finding(
          'hint',
          `The manifest has no "${key}"; ${advice}. Read more: ${MANIFEST_VALID_REF}`,
        ),
      );
    }
  }

  return findings;
}

/**
 * Reports the two install-critical icon sizes that are not declared: a browser
 * needs a 192x192 PNG (the home-screen icon) and a 512x512 PNG (the splash
 * screen). An `any`-sized PNG (a scalable icon) satisfies both. An unparsable
 * manifest yields nothing here, because `manifestValid` already reports it.
 */
export function manifestIcons(text: string): Finding[] {
  const manifest = parseManifest(text);
  if (manifest === null) {
    return [];
  }
  const icons = readIcons(manifest);
  const findings: Finding[] = [];
  if (!hasPngIconOfSize(icons, 192)) {
    findings.push(
      finding(
        'error',
        `The manifest declares no 192x192 PNG icon; add one (type "image/png", sizes "192x192") for the home-screen icon. Read more: ${MANIFEST_ICONS_REF}`,
      ),
    );
  }
  if (!hasPngIconOfSize(icons, 512)) {
    findings.push(
      finding(
        'error',
        `The manifest declares no 512x512 PNG icon; add one (type "image/png", sizes "512x512") for the splash screen. Read more: ${MANIFEST_ICONS_REF}`,
      ),
    );
  }
  return findings;
}
