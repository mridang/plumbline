import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { validateAdsTxt } from '../../lib/wellknown/ads-txt.js';
import { checkFile } from './shared.js';

/**
 * Checks /app-ads.txt against the IAB Tech Lab "app-ads.txt" specification,
 * the mobile-app and CTV addendum to ads.txt. It shares ads.txt's grammar but
 * lives at the developer-website root and declares the sellers authorised for
 * a developer's in-app inventory. The same record and variable rules apply.
 */
export default defineHint({
  id: 'app-ads-txt',
  name: 'Valid app-ads.txt',
  description:
    'Checks that /app-ads.txt follows the IAB Tech Lab app-ads.txt spec.',
  category: Category.development,
  groups: ['iab', 'seo'],
  reference:
    'https://iabtechlab.com/wp-content/uploads/2020/05/app-ads.txt-v1.0-final-.pdf',
  setup(context) {
    onSite(context, async (site) => {
      await checkFile(site, {
        path: '/app-ads.txt',
        label: 'app-ads.txt',
        mediaTypes: ['text/plain'],
        // app-ads.txt is optional and only relevant to app developers.
        missing: 'hint',
        example: (origin) =>
          `# app-ads.txt for ${new URL(origin).hostname}\nexample.com, 12345, DIRECT, f08c47fec0942fa0\n`,
        validate: (text) => validateAdsTxt(text),
      });
    });
  },
});
