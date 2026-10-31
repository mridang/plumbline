/**
 * @packageDocumentation
 *
 * What the site calls itself and where it lives, in one place for the page
 * metadata, the structured data and outbound fetches (see `lib/safe-fetch.ts`).
 * The first four constants are in every app; the rest are this app's own.
 */

/** The name of the site, as it appears in titles and structured data. */
export const SITE_NAME = 'plumbline';
/** The site's public address, with no trailing slash. */
export const SITE_URL = 'https://plumbline.apps.mrida.ng';

/** The site's default page title. */
export const SITE_TITLE = 'Check any website';
/** The site's default description, for page metadata and structured data. */
export const SITE_DESCRIPTION =
  'Type a domain and see how it does on more than 250 checks: security ' +
  'headers, TLS, DNS and email, privacy, SEO, social cards and agent readiness.';

/** Where the source lives, linked from the header and footer. */
export const SOURCE_URL = 'https://github.com/mridang/webhint-hints';
