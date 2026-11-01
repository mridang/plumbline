import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { linkFindings, ROCTIFY_REF } from '../../lib/seo/content.js';
import { reportFindings } from './report-findings.js';

/**
 * Warns when the page has no links, or none to its own site. Source: Roctify
 * SEO checker "Links". Anchors to fragments, mail, phone and scripts do not
 * count.
 */
export default defineHint({
  id: 'seo-links',
  name: 'Page has internal links',
  description: 'Warns when the page has no links or no internal links.',
  category: Category.development,
  groups: ['roctify', 'seo'],
  reference: ROCTIFY_REF,
  setup(context) {
    onPage(context, (page) => {
      const links = [...page.document.querySelectorAll('a[href]')].map((a) => ({
        href: a.getAttribute('href') ?? '',
      }));
      reportFindings(page, linkFindings(links, page.url), {
        element: page.document.querySelector('body'),
      });
    });
  },
});
