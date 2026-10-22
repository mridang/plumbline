import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { manifestLinked, MANIFEST_LINKED_REF } from '../../lib/pwa/checks.js';
import { toSeverity } from './to-severity.js';

const REF = MANIFEST_LINKED_REF;

/**
 * Requires a `<link rel="manifest">` with an absolute `href`.
 *
 * A browser only fetches a Web App Manifest, and only offers to install the
 * app, when the page declares the manifest with `<link rel="manifest">`. The
 * `href` should be absolute so the same link resolves on every route. Source:
 * W3C Web App Manifest, the manifest `<link>` (error for a missing link, a
 * warning for a document-relative one).
 *
 * The predicate, message and severity live in `src/lib/pwa/checks.ts` and are
 * shared verbatim with the Lighthouse check; this DOM hint only adds the
 * offending element and a suggested snippet.
 */

export default defineHint({
  id: 'manifest-linked',
  name: 'Page links a Web App Manifest',
  description: 'Requires a <link rel="manifest"> with an absolute href.',
  category: Category.development,
  groups: ['w3c', 'pwa'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const [found] = manifestLinked(page.document);
      if (!found) {
        return;
      }
      // A present-but-relative link points at the existing element; a missing
      // link suggests the tag to add in the <head>.
      const existing = page.document.querySelector('link[rel~="manifest" i]');
      page.report(
        found.message,
        existing
          ? { severity: toSeverity(found.severity), element: existing }
          : {
              severity: toSeverity(found.severity),
              element: page.document.querySelector('head'),
              codeSnippet: '<link rel="manifest" href="/manifest.webmanifest">',
              codeLanguage: 'html',
            },
      );
    });
  },
});
