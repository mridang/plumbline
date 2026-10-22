import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  oembedDiscovery,
  OEMBED_DISCOVERY_REF,
} from '../../lib/feeds/checks.js';
import { OEMBED_TYPES } from '../../lib/feeds/read.js';
import { toSeverity } from './to-severity.js';

const REF = OEMBED_DISCOVERY_REF;

/**
 * Checks oEmbed autodiscovery.
 *
 * A page whose content can be embedded elsewhere advertises its oEmbed
 * endpoint with `<link rel="alternate" type="application/json+oembed">` (or the
 * `text/xml+oembed` variant) and an `href`. Source: the oEmbed specification,
 * section "Discovery".
 *
 * This is a DOM-only check, single-sourced in `src/lib/feeds/checks.ts` and
 * also run as a Lighthouse audit; the hint only adds the offending element or a
 * suggested snippet.
 */
export default defineHint({
  id: 'oembed-discovery',
  name: 'oEmbed endpoint is discoverable',
  description:
    'Checks for an oEmbed <link rel="alternate" type="application/json+oembed"> with an href.',
  category: Category.development,
  // `original`/`social` are the closest existing groups; the feeds set adds its
  // own source and topic groups through `manifest.ts`, which the lead wires in.
  groups: ['oembed', 'social'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const findings = oembedDiscovery(page.document);
      if (findings.length === 0) {
        return;
      }
      // The warnings line up one-to-one, in document order, with the oEmbed
      // `<link>`s that have no href.
      const offenders = page.document
        .querySelectorAll('link[rel~="alternate" i][type]')
        .filter((element) => {
          const type = (element.getAttribute('type') ?? '')
            .trim()
            .toLowerCase();
          const href = (element.getAttribute('href') ?? '').trim();
          return (
            (OEMBED_TYPES as readonly string[]).includes(type) && href === ''
          );
        });
      let offenderIndex = 0;
      for (const found of findings) {
        if (found.severity === 'hint') {
          page.report(found.message, {
            severity: toSeverity(found.severity),
            element: page.document.querySelector('head'),
            codeSnippet: `<link rel="alternate" type="application/json+oembed" href="${page.url}oembed?url=${page.url}">`,
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
