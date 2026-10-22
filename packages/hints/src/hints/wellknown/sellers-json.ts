import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { validateSellersJson } from '../../lib/wellknown/sellers-json.js';
import { checkFile } from './shared.js';

/**
 * Checks /sellers.json against the IAB Tech Lab "sellers.json" specification
 * v1.0. The file is the counterpart to ads.txt: an advertising system
 * publishes it to declare the sellers and intermediaries in its supply chain.
 * It is served from the root as application/json with a `version` and a
 * `sellers` array whose entries name a `seller_id`, a `seller_type` and,
 * unless confidential, a `name` and `domain`.
 */
export default defineHint({
  id: 'sellers-json',
  name: 'Valid sellers.json',
  description:
    'Checks that /sellers.json follows the IAB Tech Lab sellers.json 1.0 spec.',
  category: Category.development,
  groups: ['iab', 'seo'],
  reference:
    'https://iabtechlab.com/wp-content/uploads/2019/07/Sellers.json_Final.pdf',
  setup(context) {
    onSite(context, async (site) => {
      await checkFile(site, {
        path: '/sellers.json',
        label: 'sellers.json',
        mediaTypes: ['application/json'],
        // sellers.json is published by ad systems, not ordinary sites.
        missing: 'hint',
        example: () =>
          '{\n  "version": "1.0",\n  "sellers": [\n    { "seller_id": "1", "seller_type": "PUBLISHER", "name": "Example", "domain": "example.com" }\n  ]\n}\n',
        validate: (text) => validateSellersJson(text),
      });
    });
  },
});
