import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { ROCTIFY_REF } from '../../lib/seo/content.js';
import { assetFindings } from '../../lib/technical/speed.js';
import { reportFindings } from '../seo/report-findings.js';

/**
 * Warns about more than 15 external scripts, more than 10 external
 * stylesheets and scripts in the <head> without async or defer. Source:
 * Roctify SEO checker "Scripts and stylesheets"; the limits are ours.
 */
export default defineHint({
  id: 'technical-asset-count',
  name: 'Few scripts and stylesheets',
  description:
    'Warns about many external scripts or stylesheets and render-blocking scripts.',
  category: Category.performance,
  groups: ['roctify', 'seo'],
  reference: ROCTIFY_REF,
  setup(context) {
    onPage(context, (page) => {
      const blocking =
        'head script[src]:not([async]):not([defer]):not([type="module" i])';
      reportFindings(
        page,
        assetFindings({
          scripts: page.document.querySelectorAll('script[src]').length,
          stylesheets: page.document.querySelectorAll(
            'link[rel~="stylesheet" i][href]',
          ).length,
          blockingScripts: page.document.querySelectorAll(blocking).length,
        }),
        { element: page.document.querySelector(blocking) },
      );
    });
  },
});
