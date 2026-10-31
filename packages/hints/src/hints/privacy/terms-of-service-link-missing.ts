import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  TERMS_OF_SERVICE_LINK_REF,
  termsOfServiceLinkMissing,
} from '../../lib/privacy/legal-links.js';

/**
 * Warns when the page links to no terms of service.
 *
 * Google's OAuth App Branding page requires a home page, privacy policy and
 * terms of service link for every external production app, and visitors look
 * for the terms next to the privacy policy. Source: Google Cloud "Manage OAuth
 * App Branding".
 *
 * Which links count (the `terms-of-service` link relation, the link's text or
 * its address, in several languages) lives in `src/lib/privacy/legal-links.ts`;
 * this hint reports against `<body>` with the link to add.
 */
export default defineHint({
  id: 'terms-of-service-link-missing',
  name: 'Page links its terms of service',
  description: 'Warns when the page links to no terms of service.',
  category: Category.development,
  groups: ['google', 'privacy'],
  reference: TERMS_OF_SERVICE_LINK_REF,
  setup(context) {
    onPage(context, (page) => {
      const [found] = termsOfServiceLinkMissing(page.document);
      if (found) {
        page.report(found.message, {
          severity: Severity.warning,
          element: page.document.querySelector('body'),
          codeSnippet:
            '<a href="/terms" rel="terms-of-service">Terms of service</a>',
          codeLanguage: 'html',
        });
      }
    });
  },
});
