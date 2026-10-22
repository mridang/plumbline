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
 * Cross-Origin-Embedder-Policy stops the page loading cross-origin resources that did not opt in, and together with COOP enables cross-origin isolation.
 *
 * Rules are those of Mozilla Observatory (`tests/cross-origin-embedder-policy.js`): a recognised value
 * passes, a missing header or the permissive default is advice, and a value
 * that cannot be recognised (or a header sent twice) is an error. With the
 * `owasp` profile the header must be exactly `require-corp` (OWASP Secure Headers
 * Project).
 */
export default defineHint({
  id: 'coep',
  name: 'Cross-Origin-Embedder-Policy',
  description:
    'Checks that Cross-Origin-Embedder-Policy requires embedded resources to opt in.',
  category: Category.security,
  groups: ['observatory', 'owasp', 'security-headers'],
  reference:
    'https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy',
  schema: PROFILE_SCHEMA,
  setup(context) {
    const profile = readProfile(context.hintOptions);
    onPage(context, (page) => {
      const values = headerValues(page.headers, 'cross-origin-embedder-policy');
      const metas = metaContents(
        page.document,
        'http-equiv',
        'cross-origin-embedder-policy',
      );
      reportFindings(
        page,
        crossOriginFindings('coep', values, metas, profile),
        {
          name: 'Cross-Origin-Embedder-Policy',
          value: values,
          suggest: 'require-corp',
          element:
            values.length === 0
              ? metaElements(
                  page.document,
                  'http-equiv',
                  'cross-origin-embedder-policy',
                ).at(-1)
              : undefined,
        },
      );
    });
  },
});
