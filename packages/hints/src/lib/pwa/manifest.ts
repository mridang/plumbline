/**
 * Pure helpers for the Web App Manifest, a fetched JSON document. These parse
 * the manifest text and read the members the W3C Web App Manifest spec and the
 * browser install criteria care about, with no webhint or Lighthouse types, so
 * `./checks.ts` can turn their results into findings and the unit tests can
 * exercise every member without a scan.
 *
 * Spec: https://www.w3.org/TR/appmanifest/ — member names, the `display`
 * enumeration and the `icons` member shape are taken from there. The
 * install-criteria subset (a name, a 192px and a 512px icon, a start URL, a
 * standalone-capable display, theme and background colours) follows the
 * documented installability requirements on web.dev.
 */

/** The IANA media type a manifest should be served as (appmanifest §3). */
export const MANIFEST_MEDIA_TYPE = 'application/manifest+json';

/**
 * The valid values of the `display` member (appmanifest, the
 * `DisplayModeType` enumeration). `browser` is valid but does not by itself
 * make an app installable; the rule only rejects values outside this set.
 */
export const DISPLAY_VALUES = [
  'fullscreen',
  'standalone',
  'minimal-ui',
  'browser',
] as const;

/** One entry of the manifest `icons` member, narrowed to what the rules read. */
export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

/**
 * Parses the manifest body. Returns the object on success, or null when the
 * text is not valid JSON or is valid JSON that is not a top-level object (a
 * manifest must be a JSON object, appmanifest §2).
 */
export function parseManifest(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** Returns a member as a trimmed, non-empty string, or null otherwise. */
export function readString(
  manifest: Record<string, unknown>,
  key: string,
): string | null {
  const value = manifest[key];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** True when a member is present (any JSON value other than `undefined`/`null`). */
export function hasMember(
  manifest: Record<string, unknown>,
  key: string,
): boolean {
  const value = manifest[key];
  return value !== undefined && value !== null;
}

/** True when a member is a non-empty array. */
export function hasNonEmptyArray(
  manifest: Record<string, unknown>,
  key: string,
): boolean {
  const value = manifest[key];
  return Array.isArray(value) && value.length > 0;
}

/**
 * Reads the `icons` member into {@link ManifestIcon} entries. Entries that are
 * not objects, or that carry no usable `src`, are dropped, since a browser
 * ignores them too.
 */
export function readIcons(manifest: Record<string, unknown>): ManifestIcon[] {
  const value = manifest.icons;
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === 'object' && entry !== null && !Array.isArray(entry),
    )
    .map((entry) => ({
      src: typeof entry.src === 'string' ? entry.src.trim() : '',
      sizes: typeof entry.sizes === 'string' ? entry.sizes.trim() : '',
      type: typeof entry.type === 'string' ? entry.type.trim() : '',
      purpose: typeof entry.purpose === 'string' ? entry.purpose.trim() : '',
    }))
    .filter((icon) => icon.src !== '');
}

/** True for a PNG icon, by its declared `type` or the `.png` extension of `src`. */
export function isPngIcon(icon: ManifestIcon): boolean {
  if (icon.type !== '') {
    return icon.type.toLowerCase() === 'image/png';
  }
  // No type declared: fall back to the file extension, ignoring any query.
  return icon.src.split(/[?#]/, 1)[0].toLowerCase().endsWith('.png');
}

/**
 * True when an icon declares the square size `px`×`px`. The `sizes` attribute
 * is a space-separated list of `WxH` tokens (or `any`); `any` is a scalable
 * icon that satisfies every size requirement.
 */
export function iconHasSize(icon: ManifestIcon, px: number): boolean {
  const tokens = icon.sizes.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.some((token) => token === 'any' || token === `${px}x${px}`);
}

/** True when the icon list contains a PNG that declares the square size `px`. */
export function hasPngIconOfSize(icons: ManifestIcon[], px: number): boolean {
  return icons.some((icon) => isPngIcon(icon) && iconHasSize(icon, px));
}

/** True for a valid `display` value (appmanifest `DisplayModeType`). */
export function isValidDisplay(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (DISPLAY_VALUES as readonly string[]).includes(value.trim().toLowerCase())
  );
}

/**
 * True when a string is a plausible CSS colour, which is what the `theme_color`
 * and `background_color` members must be (appmanifest references CSS Color).
 * This accepts the forms a manifest realistically uses — hex (`#rgb`, `#rrggbb`
 * and their alpha variants), the `rgb()/rgba()/hsl()/hsla()` functions and a
 * CSS named colour — rather than re-implementing the full CSS colour grammar,
 * which is more than an installability check needs.
 */
export function isValidColor(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const colour = value.trim().toLowerCase();
  if (colour === '') {
    return false;
  }
  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(colour)) {
    return true;
  }
  if (/^(?:rgb|rgba|hsl|hsla)\([^)]*\)$/.test(colour)) {
    return true;
  }
  // A CSS named colour, `transparent` or `currentColor`: letters only.
  return /^[a-z]+$/.test(colour);
}
