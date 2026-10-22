import { Category, defineHint } from '../../core/define-hint.js';
import { HintScope } from 'hint';
import { getFeedLinks } from '../../lib/feeds/read.js';
import { validateFeed, FEED_VALID_RSS_REF } from '../../lib/feeds/validate.js';
import { validateLinkedDocuments } from './shared.js';

const REF = FEED_VALID_RSS_REF;

/**
 * Fetches each discovered RSS/Atom feed and checks it is well-formed.
 *
 * Feed autodiscovery only says a feed is *declared*; whether the linked
 * document is a usable feed needs a fetch, which a DOM-only plugin cannot do,
 * so this is a webhint-only `onSite` check. A fetched body must be a
 * well-formed RSS 2.0 (`<rss>` with a `<channel>` carrying `<title>`, `<link>`
 * and `<description>`) or Atom 1.0 (`<feed>` with `<id>`, `<title>` and
 * `<updated>`) document. Sources: RSS Advisory Board (RSS 2.0) and RFC 4287
 * (Atom 1.0).
 *
 * The parse-and-validate logic is single-sourced in
 * `src/lib/feeds/validate.ts`; this hint only discovers the URLs and reports.
 */
export default defineHint({
  id: 'feed-valid',
  name: 'Discovered feeds are valid',
  description:
    'Fetches each discovered RSS/Atom feed and checks it is well-formed.',
  category: Category.development,
  // Fetching linked documents after the scan is site-scoped work.
  scope: HintScope.site,
  // `original`/`social` are the closest existing groups; the feeds set adds its
  // own source and topic groups through `manifest.ts`, which the lead wires in.
  groups: ['ietf', 'social'],
  reference: REF,
  setup(context) {
    validateLinkedDocuments(context, {
      label: 'feed',
      select: (document, baseUrl) =>
        getFeedLinks(document)
          .map((link) => link.href)
          .filter((href) => href !== '')
          // Resolve relative hrefs so a declared-but-relative feed is still
          // fetched; the discovery hint separately flags the relative href.
          .map((href) => resolve(href, baseUrl)),
      validate: (body) => validateFeed(body),
    });
  },
});

/** Resolves `href` against `baseUrl`, falling back to the raw href. */
function resolve(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}
