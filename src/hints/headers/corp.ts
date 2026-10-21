import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { crossOriginFindings } from '../../lib/headers/cross-origin.js';
import {
  headerValues,
  metaContents,
  metaElements,
} from '../../lib/headers/http-headers.js';
import { PROFILE_SCHEMA, readProfile, reportFindings } from './shared.js';

/**
 * Cross-Origin-Resource-Policy tells browsers which sites may load the response as a resource, which blocks cross-origin leaks such as Spectre-style reads. A <meta http-equiv> is also read, with the header taking precedence, as Observatory does.
 *
 * Rules are those of Mozilla Observatory (`tests/cross-origin-resource-policy.js`): a recognised value
 * passes, a missing header or the permissive default is advice, and a value
 * that cannot be recognised (or a header sent twice) is an error. With the
 * `owasp` profile the header must be exactly `same-origin` (OWASP Secure Headers
 * Project).
 */
export default defineHint({
  id: 'corp',
  name: 'Cross-Origin-Resource-Policy',
  description:
    'Checks that Cross-Origin-Resource-Policy limits who may load the page as a resource.',
  category: Category.security,
  groups: ['observatory', 'owasp', 'security-headers'],
  reference:
    'https://developer.mozilla.org/docs/Web/Security/Practical_implementation_guides/CORP',
  schema: PROFILE_SCHEMA,
  setup(context) {
    const profile = readProfile(context.hintOptions);
    onPage(context, (page) => {
      const values = headerValues(page.headers, 'cross-origin-resource-policy');
      const metas = metaContents(
        page.document,
        'http-equiv',
        'cross-origin-resource-policy',
      );
      reportFindings(
        page,
        crossOriginFindings('corp', values, metas, profile),
        {
          name: 'Cross-Origin-Resource-Policy',
          value: values,
          suggest: 'same-origin',
          element:
            values.length === 0
              ? metaElements(
                  page.document,
                  'http-equiv',
                  'cross-origin-resource-policy',
                ).at(-1)
              : undefined,
        },
      );
    });
  },
});
