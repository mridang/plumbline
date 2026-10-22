import { Category, defineHint } from '../../core/define-hint.js';
import { onPage, onSite } from '../../core/page.js';
import type { DocumentLike } from '../../lib/pwa/read.js';
import { manifestIcons, MANIFEST_ICONS_REF } from '../../lib/pwa/checks.js';
import { fetchManifest } from './fetch-manifest.js';
import { toSeverity } from './to-severity.js';

const REF = MANIFEST_ICONS_REF;

/**
 * Checks the manifest declares the two install-critical PNG icon sizes.
 *
 * This is webhint-only and part of the manifest fetch: the browser install
 * criteria need a 192x192 PNG (the home-screen icon) and a 512x512 PNG (the
 * splash screen), either declared directly or covered by an `any`-sized PNG.
 * The icon images themselves are not fetched — only the declarations in the
 * manifest's `icons` member are inspected. Source: W3C Web App Manifest, the
 * `icons` member.
 *
 * The predicate, messages and severities live in `src/lib/pwa/checks.ts`.
 */

export default defineHint({
  id: 'manifest-icons',
  name: 'Web App Manifest declares install icons',
  description: 'Checks the manifest declares a 192x192 and a 512x512 PNG icon.',
  category: Category.development,
  groups: ['w3c', 'pwa'],
  reference: REF,
  setup(context) {
    // Capture the DOM so the later onSite step can read the manifest link.
    let document: DocumentLike | null = null;
    onPage(context, (page) => {
      document = page.document;
    });
    onSite(context, async (site) => {
      const manifest = await fetchManifest(site, document);
      if (!manifest) {
        return;
      }
      for (const found of manifestIcons(manifest.text)) {
        site.report(manifest.url, found.message, {
          severity: toSeverity(found.severity),
        });
      }
    });
  },
});
