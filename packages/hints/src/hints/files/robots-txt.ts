import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { validateRobotsTxt } from '../../lib/files/robots-txt.js';
import { checkFile } from './shared.js';

/**
 * Checks that robots.txt follows RFC 9309, including Content-Signal lines.
 * Source: https://www.rfc-editor.org/rfc/rfc9309.
 */
export default defineHint({
  id: 'robots-txt',
  name: 'Valid robots.txt',
  description:
    'Checks that robots.txt follows RFC 9309, including Content-Signal lines.',
  category: Category.development,
  groups: ['files', 'seo', 'agent', 'roctify'],
  reference: 'https://www.rfc-editor.org/rfc/rfc9309',
  setup(context) {
    onSite(context, async (site) => {
      await checkFile(site, {
        path: '/robots.txt',
        label: 'robots.txt',
        mediaTypes: ['text/plain'],
        missing: 'warning',
        example: (origin) =>
          `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
        validate: (text) => validateRobotsTxt(text),
      });
    });
  },
});
