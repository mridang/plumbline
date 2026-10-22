import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { supportsLoadingModeFindings } from '../../lib/headersx/speculation.js';
import { reportFindings } from '../headers/shared.js';

/**
 * MDN: `Supports-Loading-Mode` opts a response into a non-default loading mode,
 * such as `credentialed-prerender` or `fenced-frame`. This hint validates the
 * token list when the header is present and reports unrecognised modes.
 */
export default defineHint({
  id: 'supports-loading-mode',
  name: 'Supports-Loading-Mode has valid modes',
  description:
    'Validates the Supports-Loading-Mode tokens (credentialed-prerender, fenced-frame) when present.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Supports-Loading-Mode',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'supports-loading-mode');
      reportFindings(page, supportsLoadingModeFindings(value), {
        name: 'Supports-Loading-Mode',
        value,
      });
    });
  },
});
