import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { validateAdsTxt } from '../../lib/wellknown/ads-txt.js';
import { checkFile } from './shared.js';

/**
 * Checks /ads.txt against the IAB Tech Lab "ads.txt" specification v1.1. The
 * file lists the advertising systems authorised to sell a publisher's digital
 * inventory. It must be served from the web root as text/plain and every data
 * record must carry at least an exchange domain, a publisher account id and a
 * DIRECT or RESELLER relationship. Malformed records and unknown variables are
 * reported.
 */
export default defineHint({
  id: 'ads-txt',
  name: 'Valid ads.txt',
  description:
    'Checks that /ads.txt follows the IAB Tech Lab ads.txt 1.1 spec.',
  category: Category.development,
  groups: ['iab', 'seo'],
  reference:
    'https://iabtechlab.com/wp-content/uploads/2022/04/Ads.txt-1.1.pdf',
  setup(context) {
    onSite(context, async (site) => {
      await checkFile(site, {
        path: '/ads.txt',
        label: 'ads.txt',
        mediaTypes: ['text/plain'],
        // ads.txt is optional, so its absence is advice, not an error.
        missing: 'hint',
        example: (origin) =>
          `# ads.txt for ${new URL(origin).hostname}\nexample.com, 12345, DIRECT, f08c47fec0942fa0\n`,
        validate: (text) => validateAdsTxt(text),
      });
    });
  },
});
