/**
 * @packageDocumentation
 *
 * What the site calls itself and where it lives, in one place for the page
 * metadata, the structured data and outbound fetches (see `lib/safe-fetch.ts`).
 * The first seven constants (name, address, title, description and the three
 * structured-data values) are in every app; the rest are this app's own.
 */

/** The name of the site, as it appears in titles and structured data. */
export const SITE_NAME = 'Plumbline';
/** The site's public address, with no trailing slash. */
export const SITE_URL = 'https://plumbline.apps.mrida.ng';

/** The site's default page title. */
export const SITE_TITLE = 'Check any website';
/** The site's default description, for page metadata and structured data. */
export const SITE_DESCRIPTION =
  'Type a domain and see how it does on more than 250 checks: security ' +
  'headers, TLS, DNS and email, privacy, SEO, social cards and agent readiness.';
/** The schema.org application category of the app, for the structured data. */
export const SITE_APPLICATION_CATEGORY = 'DeveloperApplication';
/** What a visitor needs to use the app, for the structured data. */
export const SITE_REQUIREMENTS =
  'Requires a modern web browser; signing in with Google is only needed to follow your GitHub repositories';
/** What the app does, one short sentence each, for the structured data. */
export const SITE_FEATURES: readonly string[] = [
  'More than 250 checks of security headers, TLS, DNS and email, privacy, SEO, social cards and agent readiness',
  'Checks run on Plumbline’s servers, and nothing about a scan is stored unless you save it',
  'Follow your GitHub repositories and get a run history, a report and a badge for each',
  'Run the same checks from the command line, Docker or a GitHub App, or connect an MCP assistant',
];

/** Where the source code lives. */
export const SOURCE_URL = 'https://github.com/mridang/plumbline';
/** Where people write to about their data or these terms. */
export const CONTACT_EMAIL = 'mridang.agarwalla@gmail.com';
/** The day the privacy policy last changed, for the page and the sitemap. */
export const PRIVACY_LAST_UPDATED = '2026-11-01';
/** The day the terms of service last changed, for the page and the sitemap. */
export const TERMS_LAST_UPDATED = '2026-11-01';
