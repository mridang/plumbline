import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { validateAppleAppSiteAssociation } from '../../lib/wellknown/apple-app-site-association.js';
import { checkFile } from './shared.js';

const EXPECTED = '/.well-known/apple-app-site-association';
const LEGACY = '/apple-app-site-association';

/**
 * Checks the apple-app-site-association (AASA) file against Apple's
 * "Supporting associated domains" documentation. It belongs at
 * /.well-known/apple-app-site-association, with the bare root path accepted as
 * a legacy location, and must be served as application/json with no `.json`
 * extension. The body declares at least one of the applinks, webcredentials
 * and appclips services, each of which is validated for the shape Apple
 * documents.
 */
export default defineHint({
  id: 'apple-app-site-association',
  name: 'Valid apple-app-site-association',
  description:
    'Checks that the apple-app-site-association file follows Apple associated-domains rules.',
  category: Category.security,
  groups: ['apple', 'security-headers'],
  reference:
    'https://developer.apple.com/documentation/xcode/supporting-associated-domains',
  setup(context) {
    onSite(context, async (site) => {
      // Prefer the well-known path; only fall back to the legacy root path
      // when the preferred one is absent.
      let path = EXPECTED;
      const preferred = await site.fetch(EXPECTED);
      if (preferred?.response.statusCode !== 200) {
        const legacy = await site.fetch(LEGACY);
        if (legacy?.response.statusCode === 200) {
          path = LEGACY;
          site.report(
            new URL(LEGACY, site.url).href,
            `The association file was found only at the legacy location ${LEGACY}; it should be at ${EXPECTED}.`,
          );
        }
      }
      await checkFile(site, {
        path,
        label: 'apple-app-site-association',
        // Apple requires application/json and forbids a .json extension.
        mediaTypes: ['application/json'],
        // Only apps that use universal links need it, so absence is advice.
        missing: 'hint',
        example: () =>
          '{\n  "applinks": {\n    "details": [\n      { "appIDs": ["ABCDE12345.com.example.app"], "components": [{ "/": "/*" }] }\n    ]\n  }\n}\n',
        validate: (text) => validateAppleAppSiteAssociation(text),
      });
    });
  },
});
