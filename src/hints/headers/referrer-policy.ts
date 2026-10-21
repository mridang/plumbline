import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  headerValues,
  metaContents,
  metaElements,
} from '../../lib/headers/http-headers.js';
import {
  effectiveReferrerPolicy,
  referrerPolicyFindings,
} from '../../lib/headers/referrer-policy.js';
import { PROFILE_SCHEMA, readProfile, reportFindings } from './shared.js';

/**
 * Referrer-Policy.
 *
 * The declaration in effect is chosen as Webbkoll does (following Firefox):
 * `<meta name="referrer">`, then `<meta http-equiv="Referrer-Policy">`, then
 * the response header; with a list of values the last one the browser knows
 * wins. The `observatory` profile (default) uses Observatory's levels:
 * `no-referrer`, `same-origin`, `strict-origin` and
 * `strict-origin-when-cross-origin` are private, `origin`,
 * `origin-when-cross-origin`, `unsafe-url` and `no-referrer-when-downgrade`
 * are unsafe, anything else is unrecognised, and no policy at all is advice.
 * The `owasp` profile requires `no-referrer`.
 *
 * The referrer sends the URL a visitor came from to the next site, which can
 * leak private paths and tokens.
 */
export default defineHint({
  id: 'referrer-policy',
  name: 'Referrer Policy',
  description:
    'Checks that a Referrer-Policy is set and does not leak the full URL to other sites.',
  category: Category.security,
  groups: [
    'observatory',
    'owasp',
    'webbkoll',
    'internetnl',
    'security-headers',
    'privacy',
  ],
  reference:
    'https://developer.mozilla.org/docs/Web/Security/Practical_implementation_guides/Referrer_policy',
  schema: PROFILE_SCHEMA,
  setup(context) {
    const profile = readProfile(context.hintOptions);
    onPage(context, (page) => {
      const header = headerValues(page.headers, 'referrer-policy');
      const declared = effectiveReferrerPolicy({
        metaName: metaContents(page.document, 'name', 'referrer'),
        metaHttpEquiv: metaContents(
          page.document,
          'http-equiv',
          'referrer-policy',
        ),
        header,
      });
      reportFindings(page, referrerPolicyFindings(declared, profile), {
        name: 'Referrer-Policy',
        value: declared,
        suggest:
          profile === 'owasp'
            ? 'no-referrer'
            : 'strict-origin-when-cross-origin',
        element:
          metaElements(page.document, 'name', 'referrer').at(-1) ??
          metaElements(page.document, 'http-equiv', 'referrer-policy').at(-1),
      });
    });
  },
});
