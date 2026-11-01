import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { ROCTIFY_REF } from '../../lib/seo/content.js';
import { htmlSizeFindings } from '../../lib/technical/speed.js';
import { reportFindings } from '../seo/report-findings.js';

/**
 * Warns when the HTML document is over 200 KB and errors over 2 MB, which is
 * as much as Googlebot reads. Source: Roctify SEO checker "HTML size"; the
 * 200 KB advice limit is ours.
 */
export default defineHint({
  id: 'technical-html-size',
  name: 'HTML is small',
  description: 'Warns when the HTML document is larger than 200 KB.',
  category: Category.performance,
  groups: ['roctify', 'seo'],
  reference: ROCTIFY_REF,
  setup(context) {
    onPage(context, (page) => {
      reportFindings(
        page,
        htmlSizeFindings(new TextEncoder().encode(page.content).length),
      );
    });
  },
});
