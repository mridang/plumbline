import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  htmlLangMissing,
  SEO_HTML_LANG_MISSING_REF,
} from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = SEO_HTML_LANG_MISSING_REF;

/**
 * Warns when <html> has no lang attribute.
 *
 * The lang attribute helps search engines and screen readers (WCAG level A). Source: opengraph.to "Missing lang Attribute on <html>" (warning).
 *
 * The predicate, message and severity live in `src/lib/seo/checks.ts`; this
 * hint only adds the `<html>` element and the snippet to add.
 */

export default defineHint({
  id: 'seo-html-lang-missing',
  name: 'Html element has a lang',
  description: 'Warns when <html> has no lang attribute.',
  category: Category.accessibility,
  groups: ['opengraph', 'seo', 'roctify'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const [found] = htmlLangMissing(page.document);
      if (found) {
        page.report(found.message, {
          severity: toSeverity(found.severity),
          element: page.document.documentElement,
          codeSnippet: '<html lang="en">',
          codeLanguage: 'html',
        });
      }
    });
  },
});
