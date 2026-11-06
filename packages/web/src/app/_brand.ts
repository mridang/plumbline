/**
 * @packageDocumentation
 *
 * Everything about this app's identity that the shared app shell reads: its
 * name and descriptions, its colours, what search engines may crawl, what the
 * installed app offers, and the wording of the not-found and error pages. The
 * shell files (`layout.tsx`, `_metadata.ts`, `manifest.ts`, `robots.ts`,
 * `sitemap.ts`, `error.tsx`, `global-error.tsx`, `not-found.tsx`) are the same
 * in every app, and this file is where they differ. It keeps the same export
 * names in every app, and holds values only: no components, no side effects.
 */

import type { MetadataRoute } from 'next';

import { SECTIONS, TAGS } from '@/domain/checks/catalogue';

import {
  PRIVACY_LAST_UPDATED,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  TERMS_LAST_UPDATED,
} from '@/utils/site';

/** The name shown in titles, the header and the installed app. */
export const BRAND_NAME = SITE_NAME;

/** The name under a home-screen icon: twelve characters at most. */
export const BRAND_SHORT_NAME = SITE_NAME;

/** A few words on what the site is, above the page heading. */
export const BRAND_TAGLINE = 'Website checks';

/** The default page title. */
export const BRAND_TITLE = SITE_TITLE;

/** The default description, for page metadata. */
export const BRAND_DESCRIPTION = SITE_DESCRIPTION;

/** The public address, with no trailing slash. */
export const BRAND_URL = SITE_URL;

/** Where vulnerabilities are reported (`security.txt`). */
export const SECURITY_CONTACT = 'mailto:mridang.agarwalla@gmail.com';

/** The security policy `security.txt` points to. */
export const SECURITY_POLICY_URL = `${SITE_URL}/security-policy.txt`;

/** The browser bar and the installed app's title bar. */
export const THEME_COLOR = '#f7f7f5';

/** The installed app's splash screen. */
export const BACKGROUND_COLOR = '#f7f7f5';

/** The page is drawn in light colours only. */
export const COLOR_SCHEME = 'only light';

/** The scan page is public, so search engines may index it. */
export const INDEX_BY_DEFAULT = true;

/** What crawlers may read: the scan page. */
export const CRAWLABLE_PATHS: readonly string[] = [
  '/$',
  '/checks',
  '/docs',
  '/privacy',
  '/terms',
];

/** What crawlers are kept out of: the API. */
export const PRIVATE_PATHS: readonly string[] = [
  '/dashboard',
  '/domains',
  '/repos',
  '/connect',
  '/login',
  '/api/',
  '/auth/',
  '/oauth/',
  '/mcp',
];

/** The pages listed in the sitemap. */
export const SITEMAP_PAGES: readonly Readonly<{
  path: string;
  lastModified?: string;
}>[] = [
  { path: '/' },
  { path: '/checks' },
  { path: '/checks/sets/recommended' },
  { path: '/checks/sets/advanced' },
  { path: '/checks/tags' },
  ...SECTIONS.map((section) => ({ path: `/checks/areas/${section.id}` })),
  ...TAGS.map((tag) => ({ path: `/checks/tags/${tag}` })),
  { path: '/checks/webhint' },
  { path: '/docs' },
  { path: '/privacy', lastModified: PRIVACY_LAST_UPDATED },
  { path: '/terms', lastModified: TERMS_LAST_UPDATED },
];

/** The installed app's name. */
export const MANIFEST_NAME = `${BRAND_NAME}: website checks`;

/** The installed app's description. */
export const MANIFEST_DESCRIPTION = BRAND_DESCRIPTION;

/** The store categories the installed app is listed under. */
export const MANIFEST_CATEGORIES: readonly string[] = [
  'developer tools',
  'utilities',
];

/**
 * What else the installed app offers: two shortcuts on its icon, to scan a
 * site and to the dashboard. No screenshots or share target.
 */
export const MANIFEST_EXTRAS: Pick<
  MetadataRoute.Manifest,
  'screenshots' | 'share_target' | 'shortcuts'
> = {
  shortcuts: [
    {
      name: 'Scan a site',
      short_name: 'Scan',
      description: 'Check a page against every rule.',
      url: '/?source=pwa-shortcut#scan',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
    },
    {
      name: 'Your dashboard',
      short_name: 'Dashboard',
      description: 'Your repositories and sites, and how each stands.',
      url: '/dashboard?source=pwa-shortcut',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
    },
  ],
};

/** The not-found page's explanation. */
export const NOT_FOUND_NOTE =
  'The link may be out of date, or the page may have been moved.';

/** A second way out of the not-found page, besides the home page. */
export const NOT_FOUND_LINK: Readonly<{ href: string; label: string }> | null =
  null;

/** The error pages' reassurance. */
export const ERROR_REASSURANCE =
  'Try again in a moment; nothing about the site you scanned was stored.';
