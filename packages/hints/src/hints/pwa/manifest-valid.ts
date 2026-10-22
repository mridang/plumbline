import { Category, defineHint } from '../../core/define-hint.js';
import { onPage, onSite } from '../../core/page.js';
import type { DocumentLike } from '../../lib/pwa/read.js';
import { manifestValid, MANIFEST_VALID_REF } from '../../lib/pwa/checks.js';
import { fetchManifest } from './fetch-manifest.js';
import { toSeverity } from './to-severity.js';

const REF = MANIFEST_VALID_REF;

/**
 * Fetches the Web App Manifest and validates it against the W3C spec.
 *
 * This is webhint-only: only a scan can fetch the manifest the page links. The
 * fetched JSON must parse, be served as `application/manifest+json`, and carry
 * the members the browser install criteria need — a name (`name` or
 * `short_name`), `start_url`, a valid `display`, a non-empty `icons` member,
 * and valid `theme_color` and `background_color` colours — with the spec's
 * recommended members (`id`, `scope`, `shortcuts`, `screenshots`,
 * `description`) surfaced as information. Source: W3C Web App Manifest.
 *
 * The specific 192/512 PNG icon sizes are checked by the `manifest-icons` hint;
 * here `icons` is only checked for presence. The predicate, messages and
 * severities live in `src/lib/pwa/checks.ts`.
 */

export default defineHint({
  id: 'manifest-valid',
  name: 'Web App Manifest is valid',
  description:
    'Fetches the Web App Manifest and validates it against the W3C spec.',
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
      for (const found of manifestValid(manifest.text, manifest.mediaType)) {
        site.report(manifest.url, found.message, {
          severity: toSeverity(found.severity),
        });
      }
    });
  },
});
