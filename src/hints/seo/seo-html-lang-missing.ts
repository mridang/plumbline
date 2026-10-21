import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { getHtmlLang } from '../../lib/seo/read.js';

const REF = 'https://www.opengraph.to/articles/missing-html-lang';

/**
 * Warns when <html> has no lang attribute.
 *
 * The lang attribute helps search engines and screen readers (WCAG level A). Source: opengraph.to "Missing lang Attribute on <html>" (warning).
 */

export default defineHint({
  id: 'seo-html-lang-missing',
  name: 'Html element has a lang',
  description: 'Warns when <html> has no lang attribute.',
  category: Category.accessibility,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      if (getHtmlLang(page.document) === null) {
        page.report(
          `The <html> element has no lang attribute, for example <html lang="en">. Read more: ${REF}`,
          {
            severity: Severity.warning,
            element: page.document.documentElement,
            codeSnippet: '<html lang="en">',
            codeLanguage: 'html',
          },
        );
      }
    });
  },
});
