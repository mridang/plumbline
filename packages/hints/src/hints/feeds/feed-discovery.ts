import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { feedDiscovery, FEED_DISCOVERY_REF } from '../../lib/feeds/checks.js';
import { FEED_TYPES } from '../../lib/feeds/read.js';
import { isAbsoluteUrl } from '../../lib/files/issue.js';
import { toSeverity } from './to-severity.js';

const REF = FEED_DISCOVERY_REF;

/**
 * Checks RSS/Atom feed autodiscovery.
 *
 * A site that publishes a feed should advertise it in the head with
 * `<link rel="alternate" type="application/rss+xml">` (or `application/atom+xml`)
 * and an absolute `href`, so feed readers that fetch the page out of its
 * context can find and resolve it. Source: RSS Advisory Board, "RSS
 * Autodiscovery".
 *
 * This is a DOM-only check, so it is single-sourced in `src/lib/feeds/checks.ts`
 * and also runs as a Lighthouse audit; the hint only adds the offending element
 * or a suggested snippet.
 */
export default defineHint({
  id: 'feed-discovery',
  name: 'Feed is discoverable',
  description:
    'Checks for an RSS/Atom feed <link rel="alternate"> with an absolute href.',
  category: Category.development,
  // `original`/`social` are the closest existing groups; the feeds set adds its
  // own source and topic groups through `manifest.ts`, which the lead wires in.
  groups: ['ietf', 'social'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const findings = feedDiscovery(page.document);
      if (findings.length === 0) {
        return;
      }
      // The warnings line up one-to-one, in document order, with the feed
      // `<link>`s whose href is not absolute.
      const offenders = page.document
        .querySelectorAll('link[rel~="alternate" i][type]')
        .filter((element) => {
          const type = (element.getAttribute('type') ?? '')
            .trim()
            .toLowerCase();
          const href = (element.getAttribute('href') ?? '').trim();
          return (
            (FEED_TYPES as readonly string[]).includes(type) &&
            !isAbsoluteUrl(href)
          );
        });
      let offenderIndex = 0;
      for (const found of findings) {
        if (found.severity === 'hint') {
          // Missing feed link: point at the head with a snippet to add.
          page.report(found.message, {
            severity: toSeverity(found.severity),
            element: page.document.querySelector('head'),
            codeSnippet: `<link rel="alternate" type="application/rss+xml" title="Feed" href="${page.url}feed.xml">`,
            codeLanguage: 'html',
          });
        } else {
          const element = offenders[offenderIndex];
          offenderIndex += 1;
          page.report(found.message, {
            severity: toSeverity(found.severity),
            ...(element ? { element } : {}),
          });
        }
      }
    });
  },
});
