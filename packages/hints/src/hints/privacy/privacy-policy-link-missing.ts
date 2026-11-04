import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  PRIVACY_POLICY_LINK_REF,
  privacyPolicyLinkMissing,
} from '../../lib/privacy/legal-links.js';

/**
 * Warns when the page links to no privacy policy.
 *
 * Google's OAuth policy says every production app must have a home page that
 * includes a link to its privacy policy, and a reviewer flags a home page
 * without "an easily accessible link" to it. The same link is what visitors
 * look for in a footer. Source: Google Cloud "App Homepage" requirements.
 *
 * Which links count (the `privacy-policy` link relation, the link's text or
 * its address, in several languages) lives in `src/lib/privacy/legal-links.ts`;
 * this hint reports against `<body>` with the link to add.
 */
export default defineHint({
  id: 'privacy-policy-link-missing',
  name: 'Page links its privacy policy',
  description: 'Warns when the page links to no privacy policy.',
  category: Category.development,
  groups: ['google', 'privacy'],
  reference: PRIVACY_POLICY_LINK_REF,
  setup(context) {
    onPage(context, (page) => {
      const [found] = privacyPolicyLinkMissing(page.document);
      if (found) {
        page.report(found.message, {
          severity: Severity.warning,
          element: page.document.querySelector('body'),
          codeSnippet:
            '<a href="/privacy" rel="privacy-policy">Privacy policy</a>',
          codeLanguage: 'html',
        });
      }
    });
  },
});
