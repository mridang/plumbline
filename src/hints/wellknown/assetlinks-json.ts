import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { validateAssetlinksJson } from '../../lib/wellknown/assetlinks-json.js';
import { checkFile } from './shared.js';

/**
 * Checks /.well-known/assetlinks.json against Google's Digital Asset Links
 * protocol. The file states which Android apps and other sites a domain
 * vouches for (used by App Links and Smart Lock). It is served as
 * application/json and is a JSON array of statements, each with a `relation`
 * array and a `target` that is either an `android_app` (with a package name
 * and SHA-256 certificate fingerprints) or a `web` site.
 */
export default defineHint({
  id: 'assetlinks-json',
  name: 'Valid assetlinks.json',
  description:
    'Checks that /.well-known/assetlinks.json follows the Digital Asset Links schema.',
  category: Category.security,
  groups: ['google', 'security-headers'],
  reference:
    'https://developers.google.com/digital-asset-links/v1/getting-started',
  setup(context) {
    onSite(context, async (site) => {
      await checkFile(site, {
        path: '/.well-known/assetlinks.json',
        label: 'assetlinks.json',
        mediaTypes: ['application/json'],
        // Only relevant to sites paired with an Android app.
        missing: 'hint',
        example: () =>
          '[\n  {\n    "relation": ["delegate_permission/common.handle_all_urls"],\n    "target": { "namespace": "android_app", "package_name": "com.example", "sha256_cert_fingerprints": ["AA:BB:CC"] }\n  }\n]\n',
        validate: (text) => validateAssetlinksJson(text),
      });
    });
  },
});
